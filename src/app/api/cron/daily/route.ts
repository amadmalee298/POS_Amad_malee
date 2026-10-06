import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { sendDebtReminders, sendMonthCloseReminder } from "@/lib/telegram/bot";
import { telegramConfigured } from "@/lib/telegram/api";

// Vercel Cron เรียกทุกวัน 09:00 น. เวลาไทย (ดู vercel.json) พร้อม header Authorization: Bearer $CRON_SECRET
// - วันที่ 1: เตือนปิดยอดเดือนที่แล้ว
// - ทุกวัน: เตือนค่างวดหนี้ (ก่อนครบกำหนด 2 วัน / วันครบกำหนด / เลยกำหนด 3 วัน)

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  if (!telegramConfigured()) return Response.json({ ok: true, skipped: "telegram not configured" });

  const firstOfMonth = todayISO().endsWith("-01");
  const links = await db.telegramLink.findMany({ select: { userId: true, chatId: true } });
  let monthClose = 0;
  let debtReminders = 0;
  for (const link of links) {
    try {
      if (firstOfMonth && (await sendMonthCloseReminder(link))) monthClose++;
      debtReminders += await sendDebtReminders(link);
    } catch (err) {
      console.error("[cron] reminder failed", link.userId, err);
    }
  }
  return Response.json({ ok: true, users: links.length, monthClose, debtReminders });
}
