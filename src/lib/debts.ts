import "server-only";
import { db } from "@/lib/db";
import { getAccountsWithBalance } from "@/lib/queries";
import { daysInMonth, parseISODate, todayISO } from "@/lib/format";

// หนี้ผ่อนชำระ: ยอดคงเหลือ = ยอดตอนเริ่มบันทึก − เงินต้นที่ชำระผ่านแอป (ยอดจ่าย − ดอกเบี้ย)
// การชำระแต่ละครั้งเป็นรายการ "รายจ่าย" หมวดหนี้สิน (มุมมองกระแสเงินสด)

const num = (d: unknown) => (d == null ? 0 : Number(d));
const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

export const DEBT_KINDS = [
  { value: "INSTALLMENT", label: "ผ่อนสินค้า / รถ", icon: "🛵" },
  { value: "LOAN", label: "สินเชื่อ / เงินกู้", icon: "🏦" },
  { value: "PERSONAL", label: "ยืมคน", icon: "🤝" },
  { value: "OTHER", label: "อื่น ๆ", icon: "🧾" },
] as const;

export type DueStatus = "paid" | "overdue" | "due-today" | "due-soon" | "upcoming" | "none" | "closed";

/** วันครบกำหนดของเดือน ym (ถ้าเดือนสั้นกว่า dueDay ใช้วันสุดท้ายของเดือน) */
function dueDateIn(ym: string, dueDay: number) {
  return parseISODate(`${ym}-${String(Math.min(dueDay, daysInMonth(ym))).padStart(2, "0")}`);
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export async function getDebts(userId: string, opts: { includeClosed?: boolean } = {}) {
  const today = todayISO();
  const ym = today.slice(0, 7);
  const todayDate = parseISODate(today);

  const debts = await db.debt.findMany({
    where: { userId, ...(opts.includeClosed ? {} : { closedAt: null }) },
    orderBy: [{ closedAt: "asc" }, { createdAt: "asc" }],
    include: {
      account: { select: { id: true, name: true, icon: true } },
      payments: { include: { transaction: { select: { amount: true, date: true } } } },
    },
  });

  return debts.map((d) => {
    const paidPrincipal = d.payments.reduce((s, p) => s + num(p.transaction.amount) - num(p.interest), 0);
    const paidTotal = d.payments.reduce((s, p) => s + num(p.transaction.amount), 0);
    const balance = Math.max(0, round2(num(d.startBalance) - paidPrincipal));
    const principal = num(d.principal);
    const monthly = d.monthlyPayment == null ? null : num(d.monthlyPayment);
    const paidThisMonth = d.payments
      .filter((p) => p.transaction.date.toISOString().slice(0, 7) === ym)
      .reduce((s, p) => s + num(p.transaction.amount), 0);
    const lastPayment = d.payments.reduce<Date | null>(
      (latest, p) => (!latest || p.transaction.date > latest ? p.transaction.date : latest),
      null,
    );

    // สถานะงวดเดือนนี้
    let status: DueStatus = "none";
    let nextDue: Date | null = null;
    let daysToDue: number | null = null;
    if (d.closedAt || balance <= 0) status = "closed";
    else if (d.dueDay) {
      const thisDue = dueDateIn(ym, d.dueDay);
      const paidEnough = monthly ? paidThisMonth >= monthly - 0.005 : paidThisMonth > 0;
      if (paidEnough) {
        status = "paid";
        nextDue = dueDateIn(nextMonth(ym), d.dueDay);
      } else {
        nextDue = thisDue;
        const diff = Math.round((thisDue.getTime() - todayDate.getTime()) / DAY);
        status = diff < 0 ? "overdue" : diff === 0 ? "due-today" : diff <= 3 ? "due-soon" : "upcoming";
      }
      daysToDue = Math.round((nextDue.getTime() - todayDate.getTime()) / DAY);
    } else if (monthly && paidThisMonth >= monthly - 0.005) status = "paid";

    return {
      id: d.id,
      name: d.name,
      icon: d.icon,
      kind: d.kind,
      lender: d.lender,
      note: d.note,
      principal,
      startBalance: num(d.startBalance),
      balance,
      paidTotal: round2(paidTotal),
      paidPct: principal > 0 ? Math.min(100, ((principal - balance) / principal) * 100) : 0,
      monthly,
      dueDay: d.dueDay,
      interestRate: d.interestRate == null ? null : num(d.interestRate),
      account: d.account,
      accountId: d.accountId,
      closed: Boolean(d.closedAt) || balance <= 0,
      paidThisMonth: round2(paidThisMonth),
      lastPayment,
      status,
      nextDue,
      daysToDue,
      monthsLeft: monthly && monthly > 0 && balance > 0 ? Math.ceil(balance / monthly) : null,
    };
  });
}

export type DebtView = Awaited<ReturnType<typeof getDebts>>[number];

/** บัตรเครดิตที่มียอดค้าง (ยอดบัญชีติดลบ) */
export async function getCardDebts(userId: string) {
  const accounts = await getAccountsWithBalance(userId);
  return accounts.filter((a) => a.type === "CREDIT_CARD" && a.balance < 0).map((a) => ({ ...a, owed: -a.balance }));
}

export class DebtError extends Error {}

async function debtCategoryId(userId: string) {
  const existing = await db.category.findFirst({ where: { userId, type: "EXPENSE", name: "หนี้สิน" } });
  if (existing) return existing.id;
  const created = await db.category.create({ data: { userId, type: "EXPENSE", name: "หนี้สิน", icon: "🧾" } });
  return created.id;
}

/** บันทึกการชำระหนี้: สร้างรายจ่ายหมวดหนี้สิน + ผูกกับหนี้ แล้วปิดหนี้ถ้าจ่ายครบ */
export async function payDebt(
  userId: string,
  input: { debtId: string; amount: number; interest?: number; accountId?: string | null; date?: string; source?: "WEB" | "TELEGRAM" },
) {
  const amount = round2(input.amount);
  const interest = round2(input.interest ?? 0);
  if (!(amount > 0) || amount >= 1e12) throw new DebtError("จำนวนเงินต้องมากกว่า 0");
  if (interest < 0 || interest > amount) throw new DebtError("ดอกเบี้ยต้องไม่เกินยอดที่จ่าย");

  const debt = await db.debt.findFirst({ where: { id: input.debtId, userId } });
  if (!debt) throw new DebtError("ไม่พบหนี้นี้");
  if (debt.closedAt) throw new DebtError("หนี้นี้ปิดแล้ว");

  const accountId = input.accountId || debt.accountId;
  if (!accountId) throw new DebtError("กรุณาเลือกบัญชีที่ใช้จ่าย");
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new DebtError("ไม่พบบัญชีที่เลือก");

  const categoryId = await debtCategoryId(userId);
  const date = parseISODate(input.date ?? todayISO());
  const tx = await db.$transaction(async (t) => {
    const created = await t.transaction.create({
      data: {
        userId,
        type: "EXPENSE",
        amount,
        date,
        accountId,
        categoryId,
        description: `ชำระ ${debt.name}`,
        note: interest > 0 ? `ดอกเบี้ย/ค่าธรรมเนียม ${interest.toFixed(2)}` : null,
        source: input.source ?? "WEB",
      },
    });
    await t.debtPayment.create({ data: { debtId: debt.id, transactionId: created.id, interest } });
    return created;
  });

  const [after] = (await getDebts(userId, { includeClosed: true })).filter((d) => d.id === debt.id);
  if (after && after.balance <= 0 && !debt.closedAt)
    await db.debt.update({ where: { id: debt.id }, data: { closedAt: new Date() } });
  return { transactionId: tx.id, debt: after, account };
}

/** เปิดหนี้กลับ ถ้าการลบการชำระทำให้ยอดคงเหลือกลับมามากกว่า 0 */
export async function reopenIfOwing(userId: string, debtId: string) {
  const [d] = (await getDebts(userId, { includeClosed: true })).filter((x) => x.id === debtId);
  if (d && d.balance > 0) await db.debt.updateMany({ where: { id: debtId, userId, closedAt: { not: null } }, data: { closedAt: null } });
}
