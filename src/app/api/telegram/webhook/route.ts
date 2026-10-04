import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot";

function validSecret(header: string | null) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Telegram ส่ง update มาที่นี่ (ตั้งค่าด้วย npm run telegram:setup) */
export async function POST(req: Request) {
  if (!validSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("Forbidden", { status: 403 });
  }
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  try {
    await handleUpdate(update);
  } catch (err) {
    // ตอบ 200 เสมอ ไม่งั้น Telegram จะส่ง update เดิมซ้ำไปเรื่อย ๆ
    console.error("[telegram] failed to handle update", update.update_id, err);
  }
  return Response.json({ ok: true });
}
