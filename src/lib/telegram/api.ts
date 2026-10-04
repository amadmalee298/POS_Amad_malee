import "server-only";

// ไคลเอนต์ Telegram Bot API แบบเบา ๆ (ไม่ต้องใช้ไลบรารีเพิ่ม)
// TELEGRAM_API_BASE ใช้ชี้ไปเซิร์ฟเวอร์จำลองตอนทดสอบได้

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type InlineKeyboard = InlineButton[][];

// ค่าจาก env ตัดช่องว่าง/บรรทัดใหม่ที่อาจติดมาตอนคัดลอกวางออกเสมอ
const env = (name: string) => process.env[name]?.trim() || undefined;
export const botToken = () => env("TELEGRAM_BOT_TOKEN");
export const webhookSecret = () => env("TELEGRAM_WEBHOOK_SECRET");

export function telegramConfigured() {
  return Boolean(botToken() && webhookSecret());
}

type TgResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

/** เรียก Bot API แล้วคืนผลดิบ (ใช้ตอนต้องการรู้สาเหตุที่ผิดพลาด) */
export async function tgRaw<T = unknown>(method: string, payload: Record<string, unknown>): Promise<TgResponse<T>> {
  const token = botToken();
  if (!token) return { ok: false, description: "missing token" };
  const base = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
  try {
    const res = await fetch(`${base}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return (await res.json()) as TgResponse<T>;
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : String(err) };
  }
}

export async function tg<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const data = await tgRaw<T>(method, payload);
  if (!data.ok) console.error(`[telegram] ${method} failed: ${data.description}`);
  return data.result ?? null;
}

let cachedUsername: string | null = null;

/** ชื่อบอต: จาก TELEGRAM_BOT_USERNAME หรือถาม Telegram (getMe) ถ้าไม่ได้ตั้งไว้ */
export async function botUsername() {
  const fromEnv = env("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "");
  if (fromEnv) return fromEnv;
  if (cachedUsername) return cachedUsername;
  const me = await tg<{ username: string }>("getMe", {});
  cachedUsername = me?.username ?? null;
  return cachedUsername;
}

export function sendMessage(chatId: string | number, text: string, keyboard?: InlineKeyboard) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
  });
}

export function editMessage(chatId: string | number, messageId: number, text: string, keyboard?: InlineKeyboard) {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });
}

export function answerCallback(id: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text && { text }) });
}

export const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** คำสั่งที่แสดงในเมนูของบอต */
export const BOT_COMMANDS = [
  { command: "today", description: "สรุปวันนี้" },
  { command: "month", description: "สรุปเดือนนี้" },
  { command: "balance", description: "ยอดเงินแต่ละบัญชี" },
  { command: "recent", description: "รายการล่าสุด" },
  { command: "account", description: "ตั้งบัญชีเริ่มต้น" },
  { command: "undo", description: "ลบรายการล่าสุดที่บันทึกผ่านแชต" },
  { command: "help", description: "วิธีใช้" },
];
