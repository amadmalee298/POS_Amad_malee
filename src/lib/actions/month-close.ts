"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { isValidMonth } from "@/lib/format";
import { CloseError, closeMonth, reopenMonth } from "@/lib/month-close";
import type { ActionResult } from "@/lib/validation";

export async function closeMonthAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const month = String(fd.get("month") ?? "");
  if (!isValidMonth(month)) return { ok: false, error: "เดือนไม่ถูกต้อง" };

  const allocations: { goalId: string; amount: number }[] = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("goal:") || typeof value !== "string" || !value.trim()) continue;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount >= 1e12) return { ok: false, error: "จำนวนเงินไม่ถูกต้อง" };
    allocations.push({ goalId: key.slice(5), amount });
  }
  const source = String(fd.get("sourceAccountId") ?? "") || null;

  try {
    const res = await closeMonth(userId, month, allocations, source);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: res.allocated > 0 ? `ปิดยอดแล้ว แบ่งเข้าเป้าหมาย ฿${res.allocated.toLocaleString("th-TH")}` : "ปิดยอดแล้ว",
    };
  } catch (err) {
    if (err instanceof CloseError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function reopenMonthAction(month: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isValidMonth(month)) return { ok: false, error: "เดือนไม่ถูกต้อง" };
  try {
    await reopenMonth(userId, month);
  } catch (err) {
    if (err instanceof CloseError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "ยกเลิกการปิดยอดแล้ว — ลบรายการโอนและหักเงินออกจากเป้าหมายคืนแล้ว" };
}
