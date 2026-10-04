import "server-only";
import { db } from "@/lib/db";
import type { CategoryType, TransactionType } from "@/generated/prisma/enums";
import { daysInMonth, monthRange, parseMonth, shiftMonth, toISODate, yearRange } from "@/lib/format";

const num = (d: unknown) => (d == null ? 0 : Number(d));

// ---------------------------------------------------------------------------
// บัญชีเงิน + ยอดคงเหลือ
// ---------------------------------------------------------------------------

export async function getAccountsWithBalance(userId: string, opts: { includeArchived?: boolean } = {}) {
  const [accounts, byAccount, transfersIn] = await Promise.all([
    db.account.findMany({
      where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
      orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.transaction.groupBy({ by: ["accountId", "type"], where: { userId }, _sum: { amount: true } }),
    db.transaction.groupBy({
      by: ["toAccountId"],
      where: { userId, type: "TRANSFER" },
      _sum: { amount: true },
    }),
  ]);

  const delta = new Map<string, number>();
  const add = (id: string, n: number) => delta.set(id, (delta.get(id) ?? 0) + n);
  for (const g of byAccount) {
    const amt = num(g._sum.amount);
    add(g.accountId, g.type === "INCOME" ? amt : -amt); // EXPENSE และ TRANSFER (ขาออก) ลดยอด
  }
  for (const g of transfersIn) if (g.toAccountId) add(g.toAccountId, num(g._sum.amount));

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    icon: a.icon,
    archived: a.archived,
    initialBalance: num(a.initialBalance),
    balance: num(a.initialBalance) + (delta.get(a.id) ?? 0),
  }));
}

export type AccountWithBalance = Awaited<ReturnType<typeof getAccountsWithBalance>>[number];

// ---------------------------------------------------------------------------
// ยอดรวมรายรับ/รายจ่ายในช่วงเวลา
// ---------------------------------------------------------------------------

export async function getTotals(userId: string, start: Date, end: Date) {
  const rows = await db.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lt: end }, type: { in: ["INCOME", "EXPENSE"] } },
    _sum: { amount: true },
    _count: true,
  });
  const income = num(rows.find((r) => r.type === "INCOME")?._sum.amount);
  const expense = num(rows.find((r) => r.type === "EXPENSE")?._sum.amount);
  const count = rows.reduce((a, r) => a + r._count, 0);
  return { income, expense, net: income - expense, count };
}

export type Totals = Awaited<ReturnType<typeof getTotals>>;

export const savingsRate = (t: { income: number; net: number }) =>
  t.income > 0 ? (t.net / t.income) * 100 : null;

// ---------------------------------------------------------------------------
// แยกตามหมวดหมู่
// ---------------------------------------------------------------------------

export async function getCategoryBreakdown(userId: string, start: Date, end: Date, type: CategoryType) {
  const [rows, categories] = await Promise.all([
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type, date: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    db.category.findMany({ where: { userId, type } }),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const total = rows.reduce((a, r) => a + num(r._sum.amount), 0);
  return rows
    .map((r) => {
      const c = r.categoryId ? catMap.get(r.categoryId) : undefined;
      const amount = num(r._sum.amount);
      return {
        categoryId: r.categoryId,
        name: c?.name ?? "ไม่ระบุหมวด",
        icon: c?.icon ?? "❔",
        amount,
        count: r._count,
        share: total > 0 ? (amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export type CategorySlice = Awaited<ReturnType<typeof getCategoryBreakdown>>[number];

// ---------------------------------------------------------------------------
// อนุกรมเวลา: รายวัน (ในเดือน) และรายเดือน (ในปี)
// ---------------------------------------------------------------------------

export type SeriesPoint = {
  key: string; // "2026-10-03" หรือ "2026-10"
  label: string; // ป้ายบนแกน
  income: number;
  expense: number;
  net: number;
  balance: number; // ยอดเงินรวมทุกบัญชี ณ สิ้นงวด
};

async function totalBalanceBefore(userId: string, date: Date) {
  const [initial, flows] = await Promise.all([
    db.account.aggregate({ where: { userId }, _sum: { initialBalance: true } }),
    db.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { lt: date }, type: { in: ["INCOME", "EXPENSE"] } },
      _sum: { amount: true },
    }),
  ]);
  const inc = num(flows.find((f) => f.type === "INCOME")?._sum.amount);
  const exp = num(flows.find((f) => f.type === "EXPENSE")?._sum.amount);
  return num(initial._sum.initialBalance) + inc - exp;
}

async function dailyFlows(userId: string, start: Date, end: Date) {
  const rows = await db.transaction.groupBy({
    by: ["date", "type"],
    where: { userId, date: { gte: start, lt: end }, type: { in: ["INCOME", "EXPENSE"] } },
    _sum: { amount: true },
  });
  return rows.map((r) => ({ day: toISODate(r.date), type: r.type as TransactionType, amount: num(r._sum.amount) }));
}

export async function getDailySeries(userId: string, ym: string): Promise<SeriesPoint[]> {
  const { start, end } = monthRange(ym);
  const [rows, opening] = await Promise.all([dailyFlows(userId, start, end), totalBalanceBefore(userId, start)]);
  const n = daysInMonth(ym);
  const points: SeriesPoint[] = Array.from({ length: n }, (_, i) => {
    const key = `${ym}-${String(i + 1).padStart(2, "0")}`;
    return { key, label: String(i + 1), income: 0, expense: 0, net: 0, balance: 0 };
  });
  for (const r of rows) {
    const p = points[Number(r.day.slice(8, 10)) - 1];
    if (!p) continue;
    if (r.type === "INCOME") p.income += r.amount;
    else p.expense += r.amount;
  }
  let running = opening;
  for (const p of points) {
    p.net = p.income - p.expense;
    running += p.net;
    p.balance = running;
  }
  return points;
}

export async function getMonthlySeries(userId: string, year: number): Promise<SeriesPoint[]> {
  const { start, end } = yearRange(year);
  const [rows, opening] = await Promise.all([dailyFlows(userId, start, end), totalBalanceBefore(userId, start)]);
  const points: SeriesPoint[] = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
    label: String(i + 1),
    income: 0,
    expense: 0,
    net: 0,
    balance: 0,
  }));
  for (const r of rows) {
    const p = points[Number(r.day.slice(5, 7)) - 1];
    if (r.type === "INCOME") p.income += r.amount;
    else p.expense += r.amount;
  }
  let running = opening;
  for (const p of points) {
    p.net = p.income - p.expense;
    running += p.net;
    p.balance = running;
  }
  return points;
}

/** ยอดรายรับ/รายจ่ายย้อนหลัง n เดือน (รวมเดือนที่ระบุ) */
export async function getRecentMonths(userId: string, ym: string, n: number) {
  const first = shiftMonth(ym, -(n - 1));
  const { start } = monthRange(first);
  const { end } = monthRange(ym);
  const rows = await dailyFlows(userId, start, end);
  const out = Array.from({ length: n }, (_, i) => {
    const key = shiftMonth(first, i);
    return { key, income: 0, expense: 0 };
  });
  for (const r of rows) {
    const p = out.find((o) => o.key === r.day.slice(0, 7));
    if (!p) continue;
    if (r.type === "INCOME") p.income += r.amount;
    else p.expense += r.amount;
  }
  return out;
}

// ---------------------------------------------------------------------------
// รายการ
// ---------------------------------------------------------------------------

export type TransactionFilters = {
  start?: Date;
  end?: Date;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  q?: string;
  take?: number;
};

export async function getTransactions(userId: string, f: TransactionFilters = {}) {
  const rows = await db.transaction.findMany({
    where: {
      userId,
      ...(f.start || f.end ? { date: { ...(f.start && { gte: f.start }), ...(f.end && { lt: f.end }) } } : {}),
      ...(f.type && { type: f.type }),
      ...(f.accountId && { OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] }),
      ...(f.categoryId && { categoryId: f.categoryId }),
      ...(f.q && {
        AND: [
          {
            OR: [
              { description: { contains: f.q, mode: "insensitive" as const } },
              { note: { contains: f.q, mode: "insensitive" as const } },
              { category: { name: { contains: f.q, mode: "insensitive" as const } } },
            ],
          },
        ],
      }),
    },
    include: {
      account: { select: { id: true, name: true, icon: true } },
      toAccount: { select: { id: true, name: true, icon: true } },
      category: { select: { id: true, name: true, icon: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: f.take,
  });
  return rows.map((t) => ({
    id: t.id,
    type: t.type,
    amount: num(t.amount),
    date: t.date,
    description: t.description,
    note: t.note,
    source: t.source,
    account: t.account,
    toAccount: t.toAccount,
    category: t.category,
  }));
}

export type TransactionRow = Awaited<ReturnType<typeof getTransactions>>[number];

export async function getCategories(userId: string, type?: CategoryType) {
  return db.category.findMany({
    where: { userId, ...(type && { type }) },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getYearsWithData(userId: string) {
  const [first, last] = await Promise.all([
    db.transaction.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
    db.transaction.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  return { first: first?.date.getUTCFullYear(), last: last?.date.getUTCFullYear() };
}

export { parseMonth };
