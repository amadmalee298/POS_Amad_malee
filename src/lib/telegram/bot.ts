import "server-only";
import { db } from "@/lib/db";
import { getAccountsWithBalance, getCategoryBreakdown, getTotals, getTransactions } from "@/lib/queries";
import { formatDate, formatMoney, monthLabel, monthRange, parseISODate, todayISO } from "@/lib/format";
import { getPendingClose } from "@/lib/month-close";
import { currentMonth, shiftMonth } from "@/lib/format";
import { parseEntry, parseTransfer } from "./parse";
import { answerCallback, editMessage, escapeHtml as h, sendMessage, type InlineKeyboard } from "./api";

// ---------------------------------------------------------------------------
// ชนิดข้อมูล (เฉพาะส่วนที่ใช้) ของ Telegram Update
// ---------------------------------------------------------------------------
type TgUser = { id: number; username?: string; first_name?: string };
type TgChat = { id: number; type: string };
type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string };
type TgCallback = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback };

type Link = { id: string; userId: string; chatId: string; defaultAccountId: string | null };

const APP_URL = () =>
  (
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
  ).replace(/\/$/, "");

const HELP = `<b>วิธีบันทึก</b> — พิมพ์รายการกับจำนวนเงิน เช่น
• <code>ข้าวกะเพรา 50</code> → รายจ่าย หมวดอาหาร
• <code>น้ำมัน 500 kbank</code> → จ่ายจากบัญชี KBank
• <code>+30000 เงินเดือน</code> → รายรับ
• <code>รับ 2500 ยอดขายร้าน</code> → รายรับ
• <code>เมื่อวาน grab 120</code> → บันทึกเป็นของเมื่อวาน
• <code>ค่าไฟ 1,250.50</code> / <code>shopee 1.2k</code>

<b>โอนเงินระหว่างบัญชี</b> (ไม่นับเป็นรายรับ/รายจ่าย)
• <code>โอน 1000 kbank truemoney</code> → KBank ไป TrueMoney
• <code>โอนเข้า scb 500 จาก kbank</code>
• <code>ถอน 3000 kbank</code> → ถอนเข้าเงินสด
• <code>ฝาก 2000 scb</code> → เงินสดเข้า SCB
• <code>จ่ายบัตร 5000 kbank</code> → จ่ายบัตรเครดิต
• <code>โอน 1000</code> → เลือกบัญชีจากปุ่ม

ระบบเดาหมวดจากคำในข้อความ แก้หมวด/บัญชี หรือยกเลิกได้จากปุ่มใต้ข้อความยืนยัน

<b>คำสั่ง</b>
/today สรุปวันนี้ · /month สรุปเดือนนี้
/balance ยอดเงินแต่ละบัญชี · /recent รายการล่าสุด
/account ตั้งบัญชีเริ่มต้น · /undo ลบรายการล่าสุด
/transfer วิธีโอนเงินระหว่างบัญชี
/close ปิดยอดเดือนที่แล้ว
/unlink ยกเลิกการเชื่อมต่อ`;

const TRANSFER_HELP = `<b>โอนเงินระหว่างบัญชี</b>
• <code>โอน 1000 kbank truemoney</code> — จากบัญชีแรกไปบัญชีที่สอง
• <code>โอนเข้า scb 500 จาก kbank</code> — ใช้คำว่า จาก / ไป / เข้า บอกทิศทาง
• <code>ถอน 3000 kbank</code> — ถอนเข้าเงินสด
• <code>ฝาก 2000 scb</code> — นำเงินสดเข้าบัญชี
• <code>จ่ายบัตร 5000 kbank</code> — จ่ายบัตรเครดิต
• <code>โอน 1000</code> — แล้วเลือกบัญชีจากปุ่ม

การโอนไม่นับเป็นรายรับหรือรายจ่าย แค่ย้ายเงินระหว่างบัญชี`;

const txLabel = (type: string) => (type === "INCOME" ? "รายรับ" : type === "EXPENSE" ? "รายจ่าย" : "โอน");

// ---------------------------------------------------------------------------
// จุดเข้า
// ---------------------------------------------------------------------------

export async function handleUpdate(update: TgUpdate) {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);

  if (msg.chat.type !== "private") {
    await sendMessage(chatId, "บอตนี้ใช้ได้เฉพาะแชตส่วนตัวเท่านั้น");
    return;
  }

  const text = msg.text.trim();
  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd.startsWith("/") ? rawCmd.slice(1).split("@")[0].toLowerCase() : null;

  if (cmd === "start" && args[0]) return linkChat(chatId, args[0], msg.from);

  const link = await db.telegramLink.findUnique({ where: { chatId } });
  if (!link) {
    const url = APP_URL();
    await sendMessage(
      chatId,
      `👋 สวัสดีครับ บอตนี้ใช้บันทึกรายรับ–รายจ่ายเข้า <b>บัญชีส่วนตัว</b>\n\nยังไม่ได้เชื่อมต่อบัญชี — เข้าเว็บแล้วไปที่ <b>ตั้งค่า → เชื่อมต่อ Telegram</b>${url ? `\n${url}/settings` : ""}`,
    );
    return;
  }

  switch (cmd) {
    case "start":
    case "help":
      return sendMessage(chatId, HELP);
    case "today":
      return sendSummary(link, "today");
    case "month":
    case "summary":
      return sendSummary(link, "month");
    case "balance":
      return sendBalance(link);
    case "close":
      return sendMonthCloseReminder(link, { always: true });
    case "recent":
      return sendRecent(link);
    case "account":
      return sendAccountPicker(link);
    case "transfer":
      return args.length ? recordEntry(link, `โอน ${args.join(" ")}`) : sendMessage(chatId, TRANSFER_HELP);
    case "undo":
      return undoLast(link);
    case "unlink":
      await db.telegramLink.delete({ where: { id: link.id } });
      return sendMessage(chatId, "ยกเลิกการเชื่อมต่อแล้ว — เชื่อมใหม่ได้จากหน้าตั้งค่าในเว็บ");
    case null:
      return recordEntry(link, text);
    default:
      return sendMessage(chatId, "ไม่รู้จักคำสั่งนี้ พิมพ์ /help เพื่อดูวิธีใช้");
  }
}

// ---------------------------------------------------------------------------
// เชื่อมบัญชี
// ---------------------------------------------------------------------------

async function linkChat(chatId: string, code: string, from?: TgUser) {
  const row = await db.telegramLinkCode.findUnique({ where: { code }, include: { user: true } });
  if (!row || row.expiresAt < new Date()) {
    if (row) await db.telegramLinkCode.delete({ where: { code } });
    await sendMessage(chatId, "❌ ลิงก์เชื่อมต่อหมดอายุหรือไม่ถูกต้อง กรุณากดเชื่อมต่อใหม่จากหน้าตั้งค่าในเว็บ");
    return;
  }
  await db.$transaction([
    db.telegramLinkCode.deleteMany({ where: { userId: row.userId } }),
    // แชตนี้เคยผูกกับผู้ใช้อื่น หรือผู้ใช้นี้เคยผูกกับแชตอื่น → แทนที่
    db.telegramLink.deleteMany({ where: { OR: [{ chatId }, { userId: row.userId }] } }),
    db.telegramLink.create({
      data: { userId: row.userId, chatId, username: from?.username ?? null, firstName: from?.first_name ?? null },
    }),
  ]);
  await sendMessage(chatId, `✅ เชื่อมต่อกับบัญชีของ <b>${h(row.user.name)}</b> เรียบร้อย\n\n${HELP}`);
}

// ---------------------------------------------------------------------------
// บันทึกรายการจากข้อความ
// ---------------------------------------------------------------------------

async function defaultAccountId(link: Link) {
  if (link.defaultAccountId) {
    const ok = await db.account.findFirst({ where: { id: link.defaultAccountId, userId: link.userId, archived: false } });
    if (ok) return ok.id;
  }
  const first = await db.account.findFirst({
    where: { userId: link.userId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return first?.id ?? null;
}

async function recordEntry(link: Link, text: string) {
  const [categories, accounts] = await Promise.all([
    db.category.findMany({ where: { userId: link.userId }, select: { id: true, name: true, type: true } }),
    db.account.findMany({ where: { userId: link.userId, archived: false }, select: { id: true, name: true, type: true } }),
  ]);

  // คำสั่งโอนเงิน (โอน/ถอน/ฝาก/จ่ายบัตร) — ถ้าไม่มีบัญชีบัตรเครดิต "จ่ายบัตร" จะบันทึกเป็นรายจ่ายตามเดิม
  const tr = parseTransfer(text, { accounts });
  if (tr && !(!tr.ok && tr.reason === "no-card-account")) {
    if (!tr.ok) {
      const msg = {
        "no-amount": "🤔 ไม่พบจำนวนเงิน ลองพิมพ์แบบนี้: <code>โอน 1000 kbank truemoney</code>",
        "bad-amount": "จำนวนเงินต้องมากกว่า 0",
        "same-account": "บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน",
        "no-cash-account": "ยังไม่มีบัญชีประเภทเงินสด — สร้างในเว็บก่อน หรือใช้ <code>โอน 3000 kbank เงินสด</code>",
        "no-card-account": "",
      }[tr.reason];
      await sendMessage(link.chatId, msg);
      return;
    }
    const t = tr.transfer;
    const fromId = t.fromId ?? (t.fromDefault ? await defaultAccountId(link) : null);
    if (fromId && fromId === t.toId) {
      await sendMessage(link.chatId, "บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน — ระบุบัญชีต้นทางในข้อความ เช่น <code>ถอน 3000 kbank</code>");
      return;
    }
    return continueTransfer(link, { amount: t.amount, fromId, toId: t.toId, daysAgo: t.daysAgo, description: t.description });
  }

  const parsed = parseEntry(text, { categories, accounts });
  if (!parsed.ok) {
    await sendMessage(
      link.chatId,
      parsed.reason === "no-amount"
        ? "🤔 ไม่พบจำนวนเงินในข้อความ ลองพิมพ์แบบนี้: <code>ข้าวกะเพรา 50</code> หรือ <code>+30000 เงินเดือน</code>\nพิมพ์ /help เพื่อดูตัวอย่างเพิ่ม"
        : "จำนวนเงินต้องมากกว่า 0",
    );
    return;
  }
  const e = parsed.entry;
  const accountId = e.accountId ?? (await defaultAccountId(link));
  if (!accountId) {
    await sendMessage(link.chatId, "ยังไม่มีบัญชีเงิน — สร้างบัญชีในเว็บก่อนนะครับ");
    return;
  }
  if (!e.categoryId) {
    await sendMessage(link.chatId, `ยังไม่มีหมวด${e.type === "INCOME" ? "รายรับ" : "รายจ่าย"} — สร้างหมวดในเว็บก่อนนะครับ`);
    return;
  }

  const date = parseISODate(todayISO());
  date.setUTCDate(date.getUTCDate() - e.daysAgo);
  const tx = await db.transaction.create({
    data: {
      userId: link.userId,
      type: e.type,
      amount: e.amount,
      date,
      accountId,
      categoryId: e.categoryId,
      description: e.description,
      source: "TELEGRAM",
    },
  });
  await sendMessage(link.chatId, await confirmationText(tx.id), txKeyboard(tx.id));
}

async function confirmationText(txId: string, prefix = "✅ บันทึกแล้ว") {
  const tx = await db.transaction.findUniqueOrThrow({
    where: { id: txId },
    include: { category: true, account: true },
  });
  const amount = Number(tx.amount);
  const isIncome = tx.type === "INCOME";
  const { start, end } = monthRange(todayISO().slice(0, 7));
  const totals = await getTotals(tx.userId, start, end);
  return [
    `${prefix} <b>${isIncome ? "รายรับ" : "รายจ่าย"} ${formatMoney(amount)}</b>`,
    `${tx.category?.icon ?? "❔"} ${h(tx.category?.name ?? "ไม่ระบุหมวด")} · ${tx.account.icon} ${h(tx.account.name)}`,
    `📅 ${formatDate(tx.date)}${tx.description ? ` · ${h(tx.description)}` : ""}`,
    "",
    `<i>เดือนนี้: รับ ${formatMoney(totals.income, { decimals: false })} · จ่าย ${formatMoney(totals.expense, { decimals: false })} · คงเหลือ ${formatMoney(totals.net, { decimals: false })}</i>`,
  ].join("\n");
}

function txKeyboard(txId: string): InlineKeyboard {
  return [
    [
      { text: "🏷 เปลี่ยนหมวด", callback_data: `c:${txId}` },
      { text: "💳 เปลี่ยนบัญชี", callback_data: `b:${txId}` },
    ],
    [{ text: "↩️ ยกเลิกรายการนี้", callback_data: `u:${txId}` }],
  ];
}

// ---------------------------------------------------------------------------
// โอนเงิน
// ---------------------------------------------------------------------------

type TransferDraft = {
  amount: number;
  fromId: string | null;
  toId: string | null;
  daysAgo: number;
  description?: string;
};

// callback_data จำกัด 64 ไบต์ → x:<วันย้อนหลัง><สตางค์ฐาน36>:<from|->:<to|-> (cuid 25 ตัว)
function encodeDraft(d: TransferDraft) {
  return `x:${d.daysAgo}${Math.round(d.amount * 100).toString(36)}:${d.fromId ?? "-"}:${d.toId ?? "-"}`;
}

function decodeDraft(data: string): TransferDraft | null {
  const m = /^x:([0-2])([0-9a-z]+):([^:]+):([^:]+)$/.exec(data);
  if (!m) return null;
  const cents = parseInt(m[2], 36);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return {
    daysAgo: Number(m[1]),
    amount: cents / 100,
    fromId: m[3] === "-" ? null : m[3],
    toId: m[4] === "-" ? null : m[4],
  };
}

/** ถ้ายังขาดบัญชี ให้เลือกจากปุ่ม ไม่งั้นบันทึกเลย */
async function continueTransfer(link: Link, d: TransferDraft, messageId?: number) {
  if (d.fromId && d.toId) {
    const res = await createTransfer(link, d);
    const [text, keyboard]: [string, InlineKeyboard | undefined] =
      typeof res === "string" ? [res, undefined] : [res.text, [[{ text: "↩️ ยกเลิกรายการนี้", callback_data: `u:${res.id}` }]]];
    if (messageId) await editMessage(link.chatId, messageId, text, keyboard);
    else await sendMessage(link.chatId, text, keyboard);
    return;
  }

  const accounts = await db.account.findMany({
    where: { userId: link.userId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const picking = d.fromId ? "to" : "from";
  const other = picking === "to" ? d.fromId : d.toId;
  const otherAcc = accounts.find((a) => a.id === other);
  const choices = accounts.filter((a) => a.id !== other);
  const title =
    picking === "from"
      ? `💸 โอน <b>${formatMoney(d.amount)}</b>${otherAcc ? ` ไป ${otherAcc.icon} ${h(otherAcc.name)}` : ""}\nเลือก<b>บัญชีต้นทาง</b>:`
      : `💸 โอน <b>${formatMoney(d.amount)}</b> จาก ${otherAcc?.icon ?? ""} ${h(otherAcc?.name ?? "")}\nเลือก<b>บัญชีปลายทาง</b>:`;
  const keyboard: InlineKeyboard = [
    ...grid(
      choices.map((a) => ({
        text: `${a.icon} ${a.name}`,
        callback_data: encodeDraft(picking === "from" ? { ...d, fromId: a.id } : { ...d, toId: a.id }),
      })),
      2,
    ),
    [{ text: "✖️ ยกเลิก", callback_data: "xc" }],
  ];
  if (messageId) await editMessage(link.chatId, messageId, title, keyboard);
  else await sendMessage(link.chatId, title, keyboard);
}

async function createTransfer(link: Link, d: TransferDraft): Promise<string | { id: string; text: string }> {
  if (d.fromId === d.toId) return "บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน";
  const accs = await db.account.findMany({ where: { userId: link.userId, id: { in: [d.fromId!, d.toId!] } } });
  const from = accs.find((a) => a.id === d.fromId);
  const to = accs.find((a) => a.id === d.toId);
  if (!from || !to) return "ไม่พบบัญชีที่เลือก";

  const date = parseISODate(todayISO());
  date.setUTCDate(date.getUTCDate() - d.daysAgo);
  const tx = await db.transaction.create({
    data: {
      userId: link.userId,
      type: "TRANSFER",
      amount: d.amount,
      date,
      accountId: from.id,
      toAccountId: to.id,
      description: d.description ?? "",
      source: "TELEGRAM",
    },
  });
  const balances = await getAccountsWithBalance(link.userId, { includeArchived: true });
  const bal = (id: string) => formatMoney(balances.find((b) => b.id === id)?.balance ?? 0);
  return {
    id: tx.id,
    text: [
      `✅ บันทึกการโอน <b>${formatMoney(d.amount)}</b>`,
      `${from.icon} ${h(from.name)} → ${to.icon} ${h(to.name)}`,
      `📅 ${formatDate(date)}${d.description ? ` · ${h(d.description)}` : ""}`,
      "",
      `<i>คงเหลือ: ${h(from.name)} ${bal(from.id)} · ${h(to.name)} ${bal(to.id)}</i>`,
    ].join("\n"),
  };
}

/** จัดปุ่มเป็นแถวละ n ปุ่ม */
function grid<T>(items: T[], n: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  return rows;
}

// ---------------------------------------------------------------------------
// ปุ่ม inline
// ---------------------------------------------------------------------------

async function handleCallback(cb: TgCallback) {
  const chatId = String(cb.message?.chat.id ?? cb.from.id);
  const messageId = cb.message?.message_id;
  const link = await db.telegramLink.findUnique({ where: { chatId } });
  if (!link || !cb.data) {
    await answerCallback(cb.id, "ยังไม่ได้เชื่อมต่อบัญชี");
    return;
  }
  const [action, a, b] = cb.data.split(":");

  // เลือกบัญชีสำหรับการโอน
  if (action === "xc") {
    await answerCallback(cb.id, "ยกเลิกแล้ว");
    if (messageId) await editMessage(chatId, messageId, "✖️ ยกเลิกการโอน");
    return;
  }
  if (action === "x") {
    const draft = decodeDraft(cb.data);
    if (!draft) return answerCallback(cb.id, "ข้อมูลไม่ถูกต้อง");
    await answerCallback(cb.id);
    return continueTransfer(link, draft, messageId);
  }

  // ตั้งบัญชีเริ่มต้น
  if (action === "d") {
    const acc = await db.account.findFirst({ where: { id: a, userId: link.userId } });
    if (!acc) return answerCallback(cb.id, "ไม่พบบัญชี");
    await db.telegramLink.update({ where: { id: link.id }, data: { defaultAccountId: acc.id } });
    await answerCallback(cb.id, "ตั้งค่าแล้ว");
    if (messageId) await editMessage(chatId, messageId, `✅ บัญชีเริ่มต้น: ${acc.icon} <b>${h(acc.name)}</b>\nรายการที่ไม่ระบุบัญชีจะบันทึกเข้าบัญชีนี้`);
    return;
  }

  const tx = await db.transaction.findFirst({ where: { id: a, userId: link.userId } });
  if (!tx) {
    await answerCallback(cb.id, "ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)");
    if (messageId) await editMessage(chatId, messageId, "รายการนี้ถูกลบแล้ว");
    return;
  }

  switch (action) {
    case "u": {
      await db.transaction.delete({ where: { id: tx.id } });
      await answerCallback(cb.id, "ยกเลิกแล้ว");
      if (messageId)
        await editMessage(chatId, messageId, `↩️ <s>${txLabel(tx.type)} ${formatMoney(Number(tx.amount))}${tx.description ? ` ${h(tx.description)}` : ""}</s> — ยกเลิกแล้ว`);
      return;
    }
    case "c": {
      const cats = await db.category.findMany({
        where: { userId: link.userId, type: tx.type === "INCOME" ? "INCOME" : "EXPENSE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      await answerCallback(cb.id);
      if (messageId)
        await editMessage(chatId, messageId, "เลือกหมวดหมู่ใหม่:", [
          ...grid(cats.map((c) => ({ text: `${c.icon} ${c.name}`, callback_data: `sc:${tx.id}:${c.id}` })), 2),
          [{ text: "« กลับ", callback_data: `v:${tx.id}` }],
        ]);
      return;
    }
    case "b": {
      const accs = await db.account.findMany({ where: { userId: link.userId, archived: false }, orderBy: [{ sortOrder: "asc" }] });
      await answerCallback(cb.id);
      if (messageId)
        await editMessage(chatId, messageId, "เลือกบัญชีใหม่:", [
          ...grid(accs.map((x) => ({ text: `${x.icon} ${x.name}`, callback_data: `sa:${tx.id}:${x.id}` })), 2),
          [{ text: "« กลับ", callback_data: `v:${tx.id}` }],
        ]);
      return;
    }
    case "sc": {
      const cat = await db.category.findFirst({ where: { id: b, userId: link.userId } });
      if (!cat || cat.type !== tx.type) return answerCallback(cb.id, "หมวดไม่ถูกต้อง");
      await db.transaction.update({ where: { id: tx.id }, data: { categoryId: cat.id } });
      await answerCallback(cb.id, `เปลี่ยนเป็น ${cat.name}`);
      if (messageId) await editMessage(chatId, messageId, await confirmationText(tx.id, "✏️ แก้ไขแล้ว"), txKeyboard(tx.id));
      return;
    }
    case "sa": {
      const acc = await db.account.findFirst({ where: { id: b, userId: link.userId } });
      if (!acc) return answerCallback(cb.id, "ไม่พบบัญชี");
      await db.transaction.update({ where: { id: tx.id }, data: { accountId: acc.id } });
      await answerCallback(cb.id, `เปลี่ยนเป็น ${acc.name}`);
      if (messageId) await editMessage(chatId, messageId, await confirmationText(tx.id, "✏️ แก้ไขแล้ว"), txKeyboard(tx.id));
      return;
    }
    case "v": {
      await answerCallback(cb.id);
      if (messageId) await editMessage(chatId, messageId, await confirmationText(tx.id), txKeyboard(tx.id));
      return;
    }
    default:
      await answerCallback(cb.id);
  }
}

// ---------------------------------------------------------------------------
// คำสั่งสรุป
// ---------------------------------------------------------------------------

async function sendSummary(link: Link, period: "today" | "month") {
  const today = todayISO();
  const range =
    period === "today"
      ? { start: parseISODate(today), end: new Date(parseISODate(today).getTime() + 86_400_000) }
      : monthRange(today.slice(0, 7));
  const [totals, cats] = await Promise.all([
    getTotals(link.userId, range.start, range.end),
    getCategoryBreakdown(link.userId, range.start, range.end, "EXPENSE"),
  ]);
  const title = period === "today" ? `📊 สรุปวันนี้ (${formatDate(parseISODate(today))})` : `📊 สรุป${monthLabel(today.slice(0, 7))}`;
  const lines = [
    `<b>${title}</b>`,
    `🔵 รายรับ ${formatMoney(totals.income)}`,
    `🟠 รายจ่าย ${formatMoney(totals.expense)}`,
    `💰 คงเหลือ <b>${formatMoney(totals.net)}</b>`,
  ];
  if (period === "month" && totals.income > 0)
    lines.push(`📈 Savings Rate ${Math.round((totals.net / totals.income) * 100)}%`);
  if (cats.length) {
    lines.push("", "<b>รายจ่ายตามหมวด</b>");
    for (const c of cats.slice(0, 6)) lines.push(`${c.icon} ${h(c.name)} ${formatMoney(c.amount)} (${Math.round(c.share)}%)`);
  } else if (totals.count === 0) {
    lines.push("", "<i>ยังไม่มีรายการ</i>");
  }
  const url = APP_URL();
  await sendMessage(link.chatId, lines.join("\n"), url ? [[{ text: "เปิดแดชบอร์ด", url: `${url}/dashboard` }]] : undefined);
}

async function sendBalance(link: Link) {
  const accounts = await getAccountsWithBalance(link.userId);
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const lines = ["<b>💼 ยอดเงินแต่ละบัญชี</b>", ...accounts.map((a) => `${a.icon} ${h(a.name)}: ${formatMoney(a.balance)}`), "", `รวม <b>${formatMoney(total)}</b>`];
  await sendMessage(link.chatId, lines.join("\n"));
}

async function sendRecent(link: Link) {
  const rows = await getTransactions(link.userId, { take: 10 });
  if (!rows.length) return sendMessage(link.chatId, "ยังไม่มีรายการ");
  const lines = ["<b>🧾 รายการล่าสุด</b>"];
  for (const t of rows) {
    const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : "⇄";
    const label = t.type === "TRANSFER" ? `${t.account.name} → ${t.toAccount?.name ?? "?"}` : t.description || t.category?.name || "";
    lines.push(`${formatDate(t.date, false)} ${t.category?.icon ?? ""} ${h(label)} <b>${sign}${formatMoney(t.amount)}</b>`);
  }
  await sendMessage(link.chatId, lines.join("\n"));
}

async function sendAccountPicker(link: Link) {
  const [accounts, current] = await Promise.all([
    db.account.findMany({ where: { userId: link.userId, archived: false }, orderBy: [{ sortOrder: "asc" }] }),
    defaultAccountId(link),
  ]);
  await sendMessage(
    link.chatId,
    "เลือก<b>บัญชีเริ่มต้น</b>สำหรับรายการที่ไม่ได้ระบุบัญชี:",
    grid(
      accounts.map((a) => ({ text: `${a.id === current ? "✓ " : ""}${a.icon} ${a.name}`, callback_data: `d:${a.id}` })),
      2,
    ),
  );
}

async function undoLast(link: Link) {
  const last = await db.transaction.findFirst({
    where: { userId: link.userId, source: "TELEGRAM" },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return sendMessage(link.chatId, "ไม่มีรายการที่บันทึกผ่านแชตให้ยกเลิก");
  await db.transaction.delete({ where: { id: last.id } });
  await sendMessage(
    link.chatId,
    `↩️ ลบ${txLabel(last.type)} ${formatMoney(Number(last.amount))}${last.description ? ` (${h(last.description)})` : ""} แล้ว`,
  );
}

// ---------------------------------------------------------------------------
// เตือนปิดยอดเดือน (คำสั่ง /close และ cron วันที่ 1)
// ---------------------------------------------------------------------------

/** ส่งสรุปเดือนที่แล้วพร้อมปุ่มไปหน้าปิดยอด — คืน true ถ้าส่งข้อความเตือน */
export async function sendMonthCloseReminder(link: Pick<Link, "userId" | "chatId">, opts: { always?: boolean } = {}) {
  const pending = await getPendingClose(link.userId);
  if (!pending) {
    if (opts.always)
      await sendMessage(link.chatId, `✅ ${monthLabel(shiftMonth(currentMonth(), -1))} ปิดยอดแล้ว หรือไม่มีรายการ`);
    return false;
  }
  const url = APP_URL();
  const lines = [
    `📅 <b>ปิดยอด${pending.label}</b>`,
    `🔵 รายรับ ${formatMoney(pending.income)}`,
    `🟠 รายจ่าย ${formatMoney(pending.expense)}`,
    pending.net > 0 ? `💰 เหลือ <b>${formatMoney(pending.net)}</b>` : `⚠️ ใช้เกินรายรับ <b>${formatMoney(-pending.net)}</b>`,
    "",
    pending.net > 0
      ? "แบ่งเงินที่เหลือเข้าเป้าหมาย แล้วแอปจะสร้างรายการโอนเข้าบัญชีเก็บเงินให้"
      : "เปิดหน้าปิดยอดเพื่อตรวจและบันทึกว่าดูเดือนนี้แล้ว",
  ];
  await sendMessage(
    link.chatId,
    lines.join("\n"),
    url ? [[{ text: pending.net > 0 ? "แบ่งเงินเลย" : "เปิดหน้าปิดยอด", url: `${url}/monthly/${pending.month}` }]] : undefined,
  );
  return true;
}
