import "server-only";
import { headers } from "next/headers";
import { BOT_COMMANDS, botToken, tgRaw, webhookSecret } from "./api";

// ตรวจสถานะและตั้งค่า webhook ของบอตจากหน้าเว็บ (แทนการประกอบลิงก์ setWebhook เอง)

const SECRET_RE = /^[A-Za-z0-9_-]{1,256}$/;

/** URL หลักของเว็บ: APP_URL → โดเมน production ของ Vercel → host ของคำขอปัจจุบัน */
export async function appBaseUrl() {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : null;
}

export type BotStatus = {
  missing: string[]; // ชื่อตัวแปรที่ยังไม่ได้ตั้ง
  problem: string | null; // ปัญหาที่ต้องแก้ใน Vercel ก่อน
  username: string | null;
  expectedUrl: string | null;
  webhookUrl: string | null;
  webhookOk: boolean;
  lastError: string | null;
};

export async function getBotStatus(): Promise<BotStatus> {
  const status: BotStatus = {
    missing: [],
    problem: null,
    username: null,
    expectedUrl: null,
    webhookUrl: null,
    webhookOk: false,
    lastError: null,
  };
  if (!botToken()) status.missing.push("TELEGRAM_BOT_TOKEN");
  if (!webhookSecret()) status.missing.push("TELEGRAM_WEBHOOK_SECRET");
  if (status.missing.length) return status;

  if (!SECRET_RE.test(webhookSecret()!)) {
    status.problem = "TELEGRAM_WEBHOOK_SECRET มีอักขระที่ใช้ไม่ได้ — ใช้ได้เฉพาะ A-Z a-z 0-9 _ - (ลบ + / = หรือช่องว่างออก) แล้ว Redeploy";
    return status;
  }

  const me = await tgRaw<{ username: string }>("getMe", {});
  if (!me.ok) {
    status.problem =
      me.error_code === 401 || me.error_code === 404
        ? "TELEGRAM_BOT_TOKEN ไม่ถูกต้อง — คัดลอก token จาก @BotFather ใหม่ (ทั้งหมด รวมเลขหน้า :) แล้ว Redeploy"
        : `ติดต่อ Telegram ไม่ได้: ${me.description ?? "unknown error"}`;
    return status;
  }
  status.username = me.result!.username;

  const base = await appBaseUrl();
  status.expectedUrl = base ? `${base}/api/telegram/webhook` : null;

  const info = await tgRaw<{ url: string; last_error_message?: string; last_error_date?: number }>("getWebhookInfo", {});
  if (info.ok) {
    status.webhookUrl = info.result!.url || null;
    status.webhookOk = Boolean(status.webhookUrl && status.webhookUrl === status.expectedUrl);
    // แสดงข้อผิดพลาดล่าสุดเฉพาะที่เกิดใน 1 วันที่ผ่านมา
    const recent = info.result!.last_error_date && Date.now() / 1000 - info.result!.last_error_date < 86_400;
    status.lastError = recent ? (info.result!.last_error_message ?? null) : null;
  }
  return status;
}

export async function setupWebhook(): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const status = await getBotStatus();
  if (status.missing.length) return { ok: false, error: `ยังไม่ได้ตั้งค่า ${status.missing.join(", ")} ใน Vercel` };
  if (status.problem) return { ok: false, error: status.problem };
  if (!status.expectedUrl?.startsWith("https://"))
    return { ok: false, error: "ไม่ทราบ URL ของเว็บ (ต้องเป็น https) — ตั้งค่า APP_URL ใน Vercel แล้ว Redeploy" };

  const res = await tgRaw("setWebhook", {
    url: status.expectedUrl,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!res.ok) return { ok: false, error: `Telegram ปฏิเสธการตั้งค่า: ${res.description}` };
  await tgRaw("setMyCommands", { commands: BOT_COMMANDS });
  return { ok: true, username: status.username! };
}
