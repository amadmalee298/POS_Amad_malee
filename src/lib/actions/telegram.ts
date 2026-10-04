"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { botUsername, sendMessage, telegramConfigured } from "@/lib/telegram/api";

const CODE_TTL_MS = 15 * 60 * 1000;

export type LinkCodeResult = { ok: true; code: string; url: string; expiresAt: string } | { ok: false; error: string };

/** สร้างรหัสเชื่อมต่อแบบใช้ครั้งเดียว (อายุ 15 นาที) */
export async function createTelegramLinkCodeAction(): Promise<LinkCodeResult> {
  const userId = await requireUserId();
  const bot = botUsername();
  if (!telegramConfigured() || !bot) return { ok: false, error: "ยังไม่ได้ตั้งค่า Telegram bot บนเซิร์ฟเวอร์" };

  const code = randomBytes(16).toString("base64url"); // ≤ 64 ตัวอักษร, ใช้ได้กับ /start
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db.$transaction([
    db.telegramLinkCode.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] } }),
    db.telegramLinkCode.create({ data: { code, userId, expiresAt } }),
  ]);
  return { ok: true, code, url: `https://t.me/${bot}?start=${code}`, expiresAt: expiresAt.toISOString() };
}

export async function unlinkTelegramAction() {
  const userId = await requireUserId();
  const link = await db.telegramLink.findUnique({ where: { userId } });
  if (link) {
    await db.telegramLink.delete({ where: { id: link.id } });
    await sendMessage(link.chatId, "🔌 บัญชีถูกยกเลิกการเชื่อมต่อจากเว็บแล้ว");
  }
  revalidatePath("/settings");
  return { ok: true as const, message: "ยกเลิกการเชื่อมต่อ Telegram แล้ว" };
}
