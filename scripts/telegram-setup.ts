/**
 * ตั้งค่า webhook และเมนูคำสั่งของ Telegram bot
 *   npm run telegram:setup -- https://your-app.vercel.app
 * (หรือกำหนด APP_URL ใน .env แล้วรันโดยไม่ใส่ URL)
 */
import "dotenv/config";

const COMMANDS = [
  { command: "today", description: "สรุปวันนี้" },
  { command: "month", description: "สรุปเดือนนี้" },
  { command: "balance", description: "ยอดเงินแต่ละบัญชี" },
  { command: "recent", description: "รายการล่าสุด" },
  { command: "transfer", description: "โอนเงินระหว่างบัญชี" },
  { command: "close", description: "ปิดยอดเดือนที่แล้ว" },
  { command: "account", description: "ตั้งบัญชีเริ่มต้น" },
  { command: "undo", description: "ลบรายการล่าสุดที่บันทึกผ่านแชต" },
  { command: "help", description: "วิธีใช้" },
];

async function call(method: string, body: unknown) {
  const base = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
  const res = await fetch(`${base}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

async function main() {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) throw new Error("ต้องตั้ง TELEGRAM_BOT_TOKEN และ TELEGRAM_WEBHOOK_SECRET ก่อน");
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(TELEGRAM_WEBHOOK_SECRET))
    throw new Error("TELEGRAM_WEBHOOK_SECRET ใช้ได้เฉพาะ A-Z a-z 0-9 _ - (สร้างด้วย: openssl rand -hex 32)");

  const appUrl = (process.argv[2] || process.env.APP_URL || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(appUrl)) throw new Error("ใส่ URL ของเว็บ (https://...) เช่น npm run telegram:setup -- https://your-app.vercel.app");

  const me = (await call("getMe", {})) as { username: string };
  await call("setWebhook", {
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  await call("setMyCommands", { commands: COMMANDS });

  console.log(`✓ Webhook → ${appUrl}/api/telegram/webhook`);
  console.log(`✓ Bot: @${me.username}  (ตั้ง TELEGRAM_BOT_USERNAME=${me.username})`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
