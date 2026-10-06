import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendMonthCloseReminder } from "@/lib/telegram/bot";
import { telegramConfigured } from "@/lib/telegram/api";

// Vercel Cron เรียกทุกวันที่ 1 เวลา 09:00 น. (ดู vercel.json) พร้อม header Authorization: Bearer $CRON_SECRET

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  if (!telegramConfigured()) return Response.json({ ok: true, sent: 0, skipped: "telegram not configured" });

  const links = await db.telegramLink.findMany({ select: { userId: true, chatId: true } });
  let sent = 0;
  for (const link of links) {
    try {
      if (await sendMonthCloseReminder(link)) sent++;
    } catch (err) {
      console.error("[cron] month-close reminder failed", link.userId, err);
    }
  }
  return Response.json({ ok: true, users: links.length, sent });
}
