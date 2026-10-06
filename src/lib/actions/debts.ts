"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { DebtError, payDebt, reopenIfOwing } from "@/lib/debts";
import { anyMoney, debtSchema, firstError, formToObject, isoDate, type ActionResult } from "@/lib/validation";

export async function saveDebtAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = debtSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;
  if (v.accountId && !(await db.account.findFirst({ where: { id: v.accountId, userId } })))
    return { ok: false, error: "ไม่พบบัญชีที่เลือก" };

  const id = (fd.get("id") as string) || null;
  const data = {
    name: v.name,
    icon: v.icon,
    kind: v.kind,
    lender: v.lender ?? null,
    principal: v.principal,
    startBalance: v.startBalance ?? v.principal,
    monthlyPayment: v.monthlyPayment ?? null,
    dueDay: v.dueDay ?? null,
    interestRate: v.interestRate ?? null,
    accountId: v.accountId ?? null,
    note: v.note ?? null,
  };
  if (id) {
    const { count } = await db.debt.updateMany({ where: { id, userId }, data });
    if (!count) return { ok: false, error: "ไม่พบหนี้นี้" };
    await reopenIfOwing(userId, id);
  } else {
    await db.debt.create({ data: { ...data, userId } });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "แก้ไขหนี้แล้ว" : "เพิ่มหนี้แล้ว" };
}

/** ลบหนี้ — รายการรายจ่ายที่เคยชำระยังอยู่ในประวัติ */
export async function deleteDebtAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.debt.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: "ไม่พบหนี้นี้" };
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบหนี้แล้ว (รายการที่จ่ายไปแล้วยังอยู่ในประวัติ)" };
}

export async function payDebtAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const amount = anyMoney.safeParse(fd.get("amount"));
  if (!amount.success) return { ok: false, error: "จำนวนเงินไม่ถูกต้อง" };
  const interestRaw = String(fd.get("interest") ?? "").trim();
  const interest = interestRaw ? anyMoney.safeParse(interestRaw) : { success: true as const, data: 0 };
  if (!interest.success) return { ok: false, error: "ดอกเบี้ยไม่ถูกต้อง" };
  const date = isoDate.safeParse(fd.get("date"));
  if (!date.success) return { ok: false, error: "วันที่ไม่ถูกต้อง" };

  try {
    const res = await payDebt(userId, {
      debtId: String(fd.get("debtId") ?? ""),
      amount: amount.data,
      interest: interest.data,
      accountId: String(fd.get("accountId") ?? "") || null,
      date: date.data,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: res.debt?.closed ? "🎉 ปิดหนี้เรียบร้อย!" : `บันทึกการชำระแล้ว คงเหลือ ฿${res.debt?.balance.toLocaleString("th-TH")}`,
    };
  } catch (err) {
    if (err instanceof DebtError) return { ok: false, error: err.message };
    throw err;
  }
}

/** ยกเลิกการชำระ = ลบรายการรายจ่ายนั้น (การชำระถูกลบตาม) */
export async function undoDebtPaymentAction(transactionId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const payment = await db.debtPayment.findFirst({ where: { transactionId, transaction: { userId } } });
  if (!payment) return { ok: false, error: "ไม่พบการชำระนี้" };
  await db.transaction.delete({ where: { id: transactionId } });
  await reopenIfOwing(userId, payment.debtId);
  revalidatePath("/", "layout");
  return { ok: true, message: "ยกเลิกการชำระแล้ว" };
}
