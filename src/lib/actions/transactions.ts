"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { reopenIfOwing } from "@/lib/debts";
import { parseISODate } from "@/lib/format";
import { firstError, formToObject, transactionSchema, type ActionResult } from "@/lib/validation";

export type TxFormState = { error?: string } | undefined;

function safeReturnTo(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/transactions";
}

export async function saveTransactionAction(_prev: TxFormState, fd: FormData): Promise<TxFormState> {
  const userId = await requireUserId();
  const parsed = transactionSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const id = (fd.get("id") as string) || null;

  // ตรวจว่าทุกอย่างที่อ้างถึงเป็นของผู้ใช้คนนี้
  const accountIds = [v.accountId, ...(v.type === "TRANSFER" && v.toAccountId ? [v.toAccountId] : [])];
  const owned = await db.account.count({ where: { userId, id: { in: accountIds } } });
  if (owned !== accountIds.length) return { error: "ไม่พบบัญชีที่เลือก" };

  let categoryId: string | null = null;
  if (v.type !== "TRANSFER") {
    const cat = await db.category.findFirst({ where: { id: v.categoryId, userId } });
    if (!cat || cat.type !== v.type) return { error: "หมวดหมู่ไม่ตรงกับประเภทรายการ" };
    categoryId = cat.id;
  }

  const data = {
    type: v.type,
    amount: v.amount,
    date: parseISODate(v.date),
    accountId: v.accountId,
    toAccountId: v.type === "TRANSFER" ? v.toAccountId! : null,
    categoryId,
    description: v.description,
    note: v.note ?? null,
  };

  if (id) {
    const { count } = await db.transaction.updateMany({ where: { id, userId }, data });
    if (!count) return { error: "ไม่พบรายการนี้" };
  } else {
    await db.transaction.create({ data: { ...data, userId } });
  }

  revalidatePath("/", "layout");
  redirect(safeReturnTo(fd.get("returnTo")));
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const payment = await db.debtPayment.findUnique({ where: { transactionId: id }, select: { debtId: true } });
  const { count } = await db.transaction.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: "ไม่พบรายการนี้" };
  if (payment) await reopenIfOwing(userId, payment.debtId); // ลบการชำระหนี้ → หนี้ที่เคยปิดอาจกลับมาค้าง
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบรายการแล้ว" };
}
