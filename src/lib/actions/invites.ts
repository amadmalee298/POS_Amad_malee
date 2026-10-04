"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatInviteCode, generateInviteCode } from "@/lib/invite-code";
import type { ActionResult } from "@/lib/validation";

const INVITE_TTL_DAYS = 7;

export async function createInviteAction(fd: FormData): Promise<ActionResult & { code?: string }> {
  const admin = await requireAdmin();
  const note = z.string().trim().max(60).safeParse(fd.get("note") ?? "");
  const code = generateInviteCode((n) => randomBytes(n));
  await db.inviteCode.create({
    data: {
      code,
      note: note.success && note.data ? note.data : null,
      createdById: admin.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    },
  });
  revalidatePath("/settings");
  return { ok: true, message: `สร้างรหัสเชิญ ${formatInviteCode(code)} แล้ว`, code };
}

/** ยกเลิกรหัสที่ยังไม่ถูกใช้ (รหัสที่ใช้แล้วเก็บไว้เป็นประวัติ) */
export async function revokeInviteAction(code: string): Promise<ActionResult> {
  await requireAdmin();
  const { count } = await db.inviteCode.deleteMany({ where: { code, usedById: null } });
  if (!count) return { ok: false, error: "ไม่พบรหัสนี้ หรือถูกใช้ไปแล้ว" };
  revalidatePath("/settings");
  return { ok: true, message: "ยกเลิกรหัสเชิญแล้ว" };
}
