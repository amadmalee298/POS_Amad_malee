// แปลงข้อความแชตเป็นรายการรายรับ/รายจ่าย — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล (ทดสอบได้ง่าย)
//
// ตัวอย่างที่รองรับ:
//   ข้าวกะเพรา 50            → รายจ่าย 50 หมวดอาหาร
//   กาแฟ 65 truemoney        → รายจ่าย จ่ายจากบัญชี TrueMoney
//   +30000 เงินเดือน          → รายรับ
//   รับ 2500 ยอดขายร้าน       → รายรับ
//   เมื่อวาน น้ำมัน 500        → รายจ่ายของเมื่อวาน
//   ค่าไฟ 1,250.50 / grab 1.2k

export type ParseCategory = { id: string; name: string; type: "INCOME" | "EXPENSE" };
export type ParseAccount = { id: string; name: string };

export type ParsedEntry = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  categoryId: string | null;
  accountId: string | null; // null = ใช้บัญชีเริ่มต้น
  daysAgo: number;
};

export type ParseResult = { ok: true; entry: ParsedEntry } | { ok: false; reason: "no-amount" | "bad-amount" };

const INCOME_PREFIX = /^(?:\+|รายรับ|รับเงิน|รับ|ได้เงิน|ได้รับ|income)\s*/i;
const EXPENSE_PREFIX = /^(?:-|−|รายจ่าย|จ่าย|ซื้อ|expense)\s*/i;

/** คำที่บอกว่าเป็นรายรับแน่นอน แม้ไม่มีเครื่องหมาย + */
const INCOME_HINTS = ["เงินเดือน", "salary", "โบนัส", "bonus", "ยอดขาย", "ขายได้", "ขายของ", "ค่าจ้าง", "ฟรีแลนซ์", "freelance", "ปันผล", "ดอกเบี้ยรับ"];

/** คีย์เวิร์ด → ชื่อหมวดเริ่มต้น (ใช้เมื่อข้อความไม่มีชื่อหมวดตรง ๆ) — ลำดับมีผล ตรวจจากบนลงล่าง */
const KEYWORDS: { type: "INCOME" | "EXPENSE"; category: string; words: string[] }[] = [
  { type: "INCOME", category: "เงินเดือน", words: ["เงินเดือน", "salary"] },
  { type: "INCOME", category: "โบนัส", words: ["โบนัส", "bonus"] },
  { type: "INCOME", category: "Freelance", words: ["freelance", "ฟรีแลนซ์", "งานนอก", "ค่าจ้าง"] },
  { type: "INCOME", category: "รายได้ร้านครัวกะเพรา", words: ["ยอดขาย", "ขายได้", "ขายของ", "ร้าน", "กะเพรา"] },
  { type: "EXPENSE", category: "ค่าน้ำ/ไฟ", words: ["ค่าไฟ", "ค่าน้ำ", "การไฟฟ้า", "ประปา", "ไฟฟ้า"] },
  { type: "EXPENSE", category: "โทรศัพท์", words: ["ค่าโทร", "โทรศัพท์", "ค่าเน็ต", "เน็ต", "internet", "wifi", "ais", "dtac"] },
  { type: "EXPENSE", category: "บ้าน", words: ["ค่าเช่า", "ค่าห้อง", "ค่าหอ", "หอพัก", "คอนโด", "ส่วนกลาง", "บ้าน"] },
  { type: "EXPENSE", category: "หนี้สิน", words: ["ผ่อน", "หนี้", "จ่ายบัตร", "ดอกเบี้ย", "กู้"] },
  { type: "EXPENSE", category: "ธุรกิจ", words: ["วัตถุดิบ", "ของร้าน", "สต็อก", "stock"] },
  {
    type: "EXPENSE",
    category: "เดินทาง",
    words: ["น้ำมัน", "เติมแก๊ส", "แท็กซี่", "taxi", "grab", "bolt", "bts", "mrt", "รถไฟ", "รถเมล์", "วินมอไซค์", "วิน", "ทางด่วน", "ค่าจอด", "ที่จอด", "ค่ารถ", "ตั๋ว", "เครื่องบิน"],
  },
  {
    type: "EXPENSE",
    category: "ช้อปปิ้ง",
    words: ["shopee", "lazada", "ช้อป", "เสื้อ", "รองเท้า", "กระเป๋า", "ห้าง", "เซเว่น", "7-11", "7-eleven", "lotus", "โลตัส", "บิ๊กซี", "big c", "makro", "แม็คโคร", "ซื้อของ"],
  },
  {
    type: "EXPENSE",
    category: "อาหาร",
    words: ["ข้าว", "กับข้าว", "ก๋วยเตี๋ยว", "กาแฟ", "ชานม", "ชาไข่มุก", "ชา", "น้ำดื่ม", "น้ำเปล่า", "ขนม", "อาหาร", "ส้มตำ", "หมูกระทะ", "ชาบู", "บุฟเฟ่ต์", "พิซซ่า", "pizza", "kfc", "mcdonald", "starbucks", "อเมซอน", "มื้อ", "กะเพรา", "ผัด", "ไก่", "หมู", "ปลา", "ก๋วยจั๊บ", "โจ๊ก", "แกง", "เบเกอรี่", "ไอติม", "เครื่องดื่ม", "food", "lineman", "foodpanda"],
  },
];

const FALLBACK = { INCOME: ["รายได้อื่น ๆ", "รายได้อื่นๆ", "อื่น ๆ", "อื่นๆ"], EXPENSE: ["อื่น ๆ", "อื่นๆ"] };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// จำนวนเงิน: 1,250.50 / 1250 / 1.2k / 3พัน — พร้อมเครื่องหมายนำหน้า/หน่วยต่อท้าย (ถ้ามี)
const AMOUNT_RE = /([+\-−฿]?)\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(k|พัน|หมื่น|บาท|บ\.|฿)?(?![\d])/gi;

type AmountToken = { value: number; index: number; length: number; marked: boolean };

function findAmounts(text: string): AmountToken[] {
  const out: AmountToken[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const [whole, sign, int, frac, unit] = m;
    let value = Number(`${int.replace(/,/g, "")}${frac ? "." + frac : ""}`);
    const u = unit?.toLowerCase();
    if (u === "k" || u === "พัน") value *= 1000;
    if (u === "หมื่น") value *= 10000;
    out.push({ value, index: m.index!, length: whole.length, marked: Boolean(sign || unit) });
  }
  return out;
}

function removeRange(s: string, index: number, length: number) {
  return s.slice(0, index) + " " + s.slice(index + length);
}

function stripWord(s: string, word: string) {
  const i = s.toLowerCase().indexOf(word.toLowerCase());
  return i < 0 ? s : removeRange(s, i, word.length);
}

export function parseEntry(
  input: string,
  ctx: { categories: ParseCategory[]; accounts: ParseAccount[] },
): ParseResult {
  let text = input.replace(/\s+/g, " ").trim();
  let explicitType: "INCOME" | "EXPENSE" | null = null;

  if (INCOME_PREFIX.test(text)) {
    explicitType = "INCOME";
    text = text.replace(INCOME_PREFIX, "");
  } else if (EXPENSE_PREFIX.test(text)) {
    explicitType = "EXPENSE";
    text = text.replace(EXPENSE_PREFIX, "");
  }

  // วันที่: เมื่อวานซืน (2 วัน) / เมื่อวาน (1 วัน)
  let daysAgo = 0;
  if (/เมื่อวานซืน/.test(text)) {
    daysAgo = 2;
    text = text.replace(/เมื่อวานซืน/g, " ");
  } else if (/เมื่อวาน|yesterday/i.test(text)) {
    daysAgo = 1;
    text = text.replace(/เมื่อวาน|yesterday/gi, " ");
  }
  text = text.replace(/วันนี้|today/gi, " ");

  // บัญชี: ชื่อบัญชีที่ปรากฏในข้อความ (ยาวสุดก่อน) — ตรวจก่อนหาจำนวนเงิน เผื่อชื่อบัญชีมีตัวเลข
  let accountId: string | null = null;
  const lower = text.toLowerCase();
  const acc = [...ctx.accounts]
    .sort((a, b) => b.name.length - a.name.length)
    .find((a) => a.name.trim() && lower.includes(a.name.toLowerCase()));
  if (acc) {
    accountId = acc.id;
    text = stripWord(text, acc.name).replace(/(?:^|\s)(?:@|จาก|ด้วย|ผ่าน|เข้า)(?=\s|$)/g, " ");
  }
  text = text.replace(/7-11|7-eleven/gi, (m) => m.replace(/\d/g, (d) => "\u0000" + d)); // กันไม่ให้ 7-11 ถูกอ่านเป็นจำนวนเงิน

  // จำนวนเงิน: ถ้ามีตัวที่มีเครื่องหมาย/หน่วยกำกับ ใช้ตัวนั้น ไม่งั้นใช้ตัวที่มากที่สุด
  const amounts = findAmounts(text.replace(/\u0000\d/g, (m) => "#".repeat(m.length)));
  if (!amounts.length) return { ok: false, reason: "no-amount" };
  const pick = amounts.find((a) => a.marked) ?? amounts.reduce((a, b) => (b.value > a.value ? b : a));
  const amount = Math.round(pick.value * 100) / 100;
  if (!(amount > 0) || amount >= 1e12) return { ok: false, reason: "bad-amount" };
  const signChar = text.slice(pick.index, pick.index + pick.length).trim()[0];
  if (!explicitType && signChar === "+") explicitType = "INCOME";
  text = removeRange(text, pick.index, pick.length).replace(/\u0000/g, "");

  let description = text.replace(/\s+/g, " ").replace(/^[\s,.:\-–]+|[\s,.:\-–]+$/g, "").trim();
  const descLower = norm(description);

  // ประเภท: ระบุชัด > คำบ่งชี้รายรับ > ค่าเริ่มต้นเป็นรายจ่าย
  let type: "INCOME" | "EXPENSE" = explicitType ?? (INCOME_HINTS.some((w) => descLower.includes(w)) ? "INCOME" : "EXPENSE");

  // หมวด 1) ชื่อหมวดตรง ๆ (ยาวสุดก่อน, ทั้งสองประเภทถ้าไม่ได้ระบุ)
  const pool = ctx.categories.filter((c) => (explicitType ? c.type === explicitType : true));
  const direct = [...pool]
    .filter((c) => !FALLBACK[c.type].includes(c.name))
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => descLower.includes(c.name.toLowerCase()));
  let categoryId: string | null = null;
  if (direct) {
    categoryId = direct.id;
    if (!explicitType) type = direct.type;
  } else {
    // 2) คีย์เวิร์ด
    for (const k of KEYWORDS) {
      if (k.type !== type) continue;
      if (!k.words.some((w) => descLower.includes(w))) continue;
      const c = ctx.categories.find((c) => c.type === type && c.name === k.category);
      if (c) {
        categoryId = c.id;
        break;
      }
    }
  }
  // 3) หมวด "อื่น ๆ" หรือหมวดแรกของประเภทนั้น
  if (!categoryId) {
    const ofType = ctx.categories.filter((c) => c.type === type);
    categoryId = (ofType.find((c) => FALLBACK[type].includes(c.name)) ?? ofType[0])?.id ?? null;
  }

  if (description.length > 200) description = description.slice(0, 200);
  return { ok: true, entry: { type, amount, description, categoryId, accountId, daysAgo } };
}
