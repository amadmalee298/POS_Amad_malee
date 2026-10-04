"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { budgetSchema, firstError, formToObject, type ActionResult } from "@/lib/validation";

export async function saveBudgetAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = budgetSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const categoryId = parsed.data.categoryId ?? null;

  if (categoryId) {
    const cat = await db.category.findFirst({ where: { id: categoryId, userId, type: "EXPENSE" } });
    if (!cat) return { ok: false, error: "ไม่พบหมวดหมู่รายจ่ายนี้" };
  }

  // หนึ่งงบต่อหนึ่งหมวด (และงบรวมได้หนึ่งรายการ)
  const existing = await db.budget.findFirst({ where: { userId, categoryId } });
  if (existing) await db.budget.update({ where: { id: existing.id }, data: { amount: parsed.data.amount } });
  else await db.budget.create({ data: { userId, categoryId, amount: parsed.data.amount } });

  revalidatePath("/", "layout");
  return { ok: true, message: "บันทึกงบประมาณแล้ว" };
}

export async function deleteBudgetAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.budget.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: "ไม่พบงบประมาณนี้" };
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบงบประมาณแล้ว" };
}
