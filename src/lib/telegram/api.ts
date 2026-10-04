import "server-only";

// ไคลเอนต์ Telegram Bot API แบบเบา ๆ (ไม่ต้องใช้ไลบรารีเพิ่ม)
// TELEGRAM_API_BASE ใช้ชี้ไปเซิร์ฟเวอร์จำลองตอนทดสอบได้

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type InlineKeyboard = InlineButton[][];

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
}

export function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
}

export async function tg<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const base = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
  try {
    const res = await fetch(`${base}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) console.error(`[telegram] ${method} failed: ${data.description}`);
    return data.result ?? null;
  } catch (err) {
    console.error(`[telegram] ${method} error`, err);
    return null;
  }
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
