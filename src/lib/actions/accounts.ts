"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { accountSchema, firstError, formToObject, type ActionResult } from "@/lib/validation";

export async function saveAccountAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = accountSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const id = (fd.get("id") as string) || null;

  if (id) {
    const { count } = await db.account.updateMany({ where: { id, userId }, data: parsed.data });
    if (!count) return { ok: false, error: "ไม่พบบัญชีนี้" };
  } else {
    const max = await db.account.aggregate({ where: { userId }, _max: { sortOrder: true } });
    await db.account.create({ data: { ...parsed.data, userId, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "แก้ไขบัญชีแล้ว" : "เพิ่มบัญชีแล้ว" };
}

export async function setAccountArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.account.updateMany({ where: { id, userId }, data: { archived } });
  if (!count) return { ok: false, error: "ไม่พบบัญชีนี้" };
  revalidatePath("/", "layout");
  return { ok: true, message: archived ? "ซ่อนบัญชีแล้ว" : "แสดงบัญชีแล้ว" };
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const used = await db.transaction.count({ where: { userId, OR: [{ accountId: id }, { toAccountId: id }] } });
  if (used > 0)
    return { ok: false, error: `บัญชีนี้มี ${used} รายการผูกอยู่ ลบไม่ได้ — ใช้ "ซ่อนบัญชี" แทน` };
  const { count } = await db.account.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: "ไม่พบบัญชีนี้" };
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบบัญชีแล้ว" };
}
