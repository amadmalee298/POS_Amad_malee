"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { firstError, type ActionResult } from "@/lib/validation";

export async function updateProfileAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z.string().trim().min(1, "กรุณากรอกชื่อ").max(60).safeParse(fd.get("name"));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db.user.update({ where: { id: userId }, data: { name: parsed.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "บันทึกโปรไฟล์แล้ว" };
}

export async function changePasswordAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const current = String(fd.get("current") ?? "");
  const parsed = z.string().min(8, "รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร").max(100).safeParse(fd.get("next"));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(current, user.passwordHash)))
    return { ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(parsed.data, 10) } });
  return { ok: true, message: "เปลี่ยนรหัสผ่านแล้ว" };
}
