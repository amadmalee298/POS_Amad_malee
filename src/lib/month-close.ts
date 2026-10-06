import "server-only";
import { db } from "@/lib/db";
import { getAccountsWithBalance, getRecentMonths } from "@/lib/queries";
import { currentMonth, monthLabel, monthRange, parseISODate, shiftMonth, todayISO } from "@/lib/format";

// ปิดยอดเดือน: แบ่งเงินที่เหลือของเดือนที่จบแล้วเข้าเป้าหมาย
// ถ้าเป้าหมายมีบัญชีเก็บเงิน จะสร้างรายการโอน (บัญชีต้นทาง → บัญชีของเป้าหมาย) ด้วย

const num = (d: unknown) => (d == null ? 0 : Number(d));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** เดือนที่ปิดยอดได้ = เดือนที่จบไปแล้ว */
export const canCloseMonth = (ym: string) => ym < currentMonth();

export async function getMonthTotals(userId: string, ym: string) {
  const { start, end } = monthRange(ym);
  const rows = await db.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lt: end }, type: { in: ["INCOME", "EXPENSE"] } },
    _sum: { amount: true },
  });
  const income = num(rows.find((r) => r.type === "INCOME")?._sum.amount);
  const expense = num(rows.find((r) => r.type === "EXPENSE")?._sum.amount);
  return { income, expense, net: round2(income - expense) };
}

/** ตารางสรุปย้อนหลัง n เดือน (ล่าสุดก่อน) พร้อมสถานะการปิดยอด */
export async function getMonthlyHistory(userId: string, n = 12) {
  const ym = currentMonth();
  const [months, closes] = await Promise.all([
    getRecentMonths(userId, ym, n),
    db.monthClose.findMany({
      where: { userId, month: { gte: shiftMonth(ym, -(n - 1)) } },
      include: { items: true },
    }),
  ]);
  const closeOf = new Map(closes.map((c) => [c.month, c]));
  return months
    .map((m) => {
      const c = closeOf.get(m.key);
      const net = round2(m.income - m.expense);
      return {
        month: m.key,
        income: m.income,
        expense: m.expense,
        net,
        rate: m.income > 0 ? (net / m.income) * 100 : null,
        isCurrent: m.key === ym,
        closed: Boolean(c),
        allocated: c ? c.items.reduce((s, i) => s + num(i.amount), 0) : 0,
      };
    })
    .reverse();
}

export type MonthRow = Awaited<ReturnType<typeof getMonthlyHistory>>[number];

/** เดือนล่าสุดที่จบแล้วแต่ยังไม่ปิดยอด (ใช้แสดงแบนเนอร์/เตือน) */
export async function getPendingClose(userId: string) {
  const ym = shiftMonth(currentMonth(), -1);
  const [closed, totals, hasAny] = await Promise.all([
    db.monthClose.findUnique({ where: { userId_month: { userId, month: ym } }, select: { id: true } }),
    getMonthTotals(userId, ym),
    db.transaction.findFirst({ where: { userId, date: { gte: monthRange(ym).start, lt: monthRange(ym).end } }, select: { id: true } }),
  ]);
  if (closed || !hasAny) return null;
  return { month: ym, label: monthLabel(ym), ...totals };
}

/** ข้อมูลสำหรับฟอร์มปิดยอด: เป้าหมาย, บัญชี, ค่าที่แนะนำจากเดือนก่อน */
export async function getCloseFormData(userId: string, ym: string) {
  const [totals, goals, accounts, close, lastClose] = await Promise.all([
    getMonthTotals(userId, ym),
    db.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: { account: true } }),
    getAccountsWithBalance(userId),
    db.monthClose.findUnique({
      where: { userId_month: { userId, month: ym } },
      include: { items: { include: { transaction: { include: { account: true, toAccount: true } } } }, sourceAccount: true },
    }),
    db.monthClose.findFirst({
      where: { userId, month: { lt: ym } },
      orderBy: { month: "desc" },
      include: { items: true },
    }),
  ]);

  // ค่าแนะนำ: ตามสัดส่วนการแบ่งครั้งล่าสุด ไม่เกินเงินที่เหลือเดือนนี้ (ปัดลงหลักร้อย)
  const suggested: Record<string, number> = {};
  if (lastClose && totals.net > 0) {
    const prev = lastClose.items.filter((i) => i.goalId && goals.some((g) => g.id === i.goalId));
    const prevSum = prev.reduce((s, i) => s + num(i.amount), 0);
    const scale = prevSum > totals.net ? totals.net / prevSum : 1;
    for (const i of prev) suggested[i.goalId!] = Math.floor((num(i.amount) * scale) / 100) * 100;
  }

  // บัญชีต้นทางเริ่มต้น: บัญชีที่ยอดมากที่สุด (ไม่ใช่บัตรเครดิต)
  const spendable = accounts.filter((a) => a.type !== "CREDIT_CARD");
  const defaultSource = [...spendable].sort((a, b) => b.balance - a.balance)[0]?.id ?? null;

  return {
    totals,
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      target: num(g.targetAmount),
      current: num(g.currentAmount),
      account: g.account ? { id: g.account.id, name: g.account.name, icon: g.account.icon } : null,
      suggested: suggested[g.id] ?? 0,
    })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, icon: a.icon, balance: a.balance, type: a.type })),
    defaultSource,
    close: close && {
      createdAt: close.createdAt,
      source: close.sourceAccount && { name: close.sourceAccount.name, icon: close.sourceAccount.icon },
      items: close.items.map((i) => ({
        goalName: i.goalName,
        amount: num(i.amount),
        transfer: i.transaction && { from: i.transaction.account.name, to: i.transaction.toAccount?.name ?? "" },
      })),
    },
  };
}

export class CloseError extends Error {}

/** ปิดยอดเดือน — คำนวณยอดจากฐานข้อมูลเอง ไม่เชื่อค่าจากฟอร์ม */
export async function closeMonth(
  userId: string,
  ym: string,
  allocations: { goalId: string; amount: number }[],
  sourceAccountId: string | null,
) {
  if (!canCloseMonth(ym)) throw new CloseError("ปิดยอดได้เฉพาะเดือนที่จบแล้ว");
  const totals = await getMonthTotals(userId, ym);
  const items = allocations.filter((a) => a.amount > 0).map((a) => ({ ...a, amount: round2(a.amount) }));
  const sum = round2(items.reduce((s, a) => s + a.amount, 0));
  if (sum > Math.max(0, totals.net)) throw new CloseError("ยอดที่แบ่งรวมกันเกินเงินที่เหลือของเดือนนี้");

  const goals = await db.goal.findMany({ where: { userId, id: { in: items.map((i) => i.goalId) } } });
  if (goals.length !== new Set(items.map((i) => i.goalId)).size) throw new CloseError("ไม่พบเป้าหมายที่เลือก");
  const needsTransfer = goals.some((g) => g.accountId && g.accountId !== sourceAccountId);
  if (needsTransfer) {
    if (!sourceAccountId) throw new CloseError("กรุณาเลือกบัญชีที่จะโอนเงินออก");
    const src = await db.account.findFirst({ where: { id: sourceAccountId, userId } });
    if (!src) throw new CloseError("ไม่พบบัญชีต้นทาง");
  }

  const date = parseISODate(todayISO());
  const label = monthLabel(ym);
  await db.$transaction(async (tx) => {
    const exists = await tx.monthClose.findUnique({ where: { userId_month: { userId, month: ym } } });
    if (exists) throw new CloseError("เดือนนี้ปิดยอดไปแล้ว");
    const close = await tx.monthClose.create({
      data: { userId, month: ym, income: totals.income, expense: totals.expense, sourceAccountId },
    });
    for (const item of items) {
      const goal = goals.find((g) => g.id === item.goalId)!;
      let transactionId: string | null = null;
      if (goal.accountId && sourceAccountId && goal.accountId !== sourceAccountId) {
        const t = await tx.transaction.create({
          data: {
            userId,
            type: "TRANSFER",
            amount: item.amount,
            date,
            accountId: sourceAccountId,
            toAccountId: goal.accountId,
            description: `ปิดยอด ${label}: ${goal.name}`,
          },
        });
        transactionId = t.id;
      }
      await tx.goal.update({ where: { id: goal.id }, data: { currentAmount: { increment: item.amount } } });
      await tx.monthCloseItem.create({
        data: { closeId: close.id, goalId: goal.id, goalName: goal.name, amount: item.amount, transactionId },
      });
    }
  });
  return { allocated: sum, carry: round2(Math.max(0, totals.net) - sum) };
}

/** ยกเลิกการปิดยอด: ลบรายการโอนที่สร้าง และหักเงินออกจากเป้าหมายคืน */
export async function reopenMonth(userId: string, ym: string) {
  await db.$transaction(async (tx) => {
    const close = await tx.monthClose.findUnique({
      where: { userId_month: { userId, month: ym } },
      include: { items: { include: { goal: true } } },
    });
    if (!close) throw new CloseError("เดือนนี้ยังไม่ได้ปิดยอด");
    for (const item of close.items) {
      if (item.transactionId) await tx.transaction.deleteMany({ where: { id: item.transactionId, userId } });
      if (item.goal) {
        const next = Math.max(0, num(item.goal.currentAmount) - num(item.amount));
        await tx.goal.update({ where: { id: item.goal.id }, data: { currentAmount: next } });
      }
    }
    await tx.monthClose.delete({ where: { id: close.id } });
  });
}
