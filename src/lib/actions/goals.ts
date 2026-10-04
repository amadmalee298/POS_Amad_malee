"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { parseISODate } from "@/lib/format";
import { anyMoney, firstError, formToObject, goalSchema, type ActionResult } from "@/lib/validation";

export async function saveGoalAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = goalSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const id = (fd.get("id") as string) || null;
  const v = parsed.data;
  const data = {
    name: v.name,
    icon: v.icon,
    targetAmount: v.targetAmount,
    currentAmount: v.currentAmount,
    targetDate: v.targetDate ? parseISODate(v.targetDate) : null,
    note: v.note ?? null,
  };

  if (id) {
    const { count } = await db.goal.updateMany({ where: { id, userId }, data });
    if (!count) return { ok: false, error: "ไม่พบเป้าหมายนี้" };
  } else {
    await db.goal.create({ data: { ...data, userId } });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "แก้ไขเป้าหมายแล้ว" : "เพิ่มเป้าหมายแล้ว" };
}

/** เพิ่ม (หรือถอน ถ้า direction = "out") เงินในเป้าหมาย */
export async function adjustGoalAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = String(fd.get("id") ?? "");
  const parsed = anyMoney.safeParse(fd.get("amount"));
  if (!parsed.success || parsed.data <= 0) return { ok: false, error: "จำนวนเงินต้องมากกว่า 0" };
  const delta = fd.get("direction") === "out" ? -parsed.data : parsed.data;

  const goal = await db.goal.findFirst({ where: { id, userId } });
  if (!goal) return { ok: false, error: "ไม่พบเป้าหมายนี้" };
  const next = Number(goal.currentAmount) + delta;
  if (next < 0) return { ok: false, error: "ยอดถอนมากกว่ายอดที่เก็บไว้" };

  await db.goal.update({ where: { id }, data: { currentAmount: next } });
  revalidatePath("/", "layout");
  return { ok: true, message: delta > 0 ? "เพิ่มเงินเข้าเป้าหมายแล้ว" : "ถอนเงินจากเป้าหมายแล้ว" };
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.goal.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: "ไม่พบเป้าหมายนี้" };
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบเป้าหมายแล้ว" };
}
