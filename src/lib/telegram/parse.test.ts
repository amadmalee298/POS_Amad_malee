import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDebtPayment, parseEntry, parseTransfer, type ParseAccount, type ParseCategory } from "./parse";

const categories: ParseCategory[] = [
  ...["เงินเดือน", "รายได้ร้านครัวกะเพรา", "Freelance", "โบนัส", "รายได้อื่น ๆ"].map((name) => ({ id: `in:${name}`, name, type: "INCOME" as const })),
  ...["อาหาร", "เดินทาง", "บ้าน", "ช้อปปิ้ง", "ค่าน้ำ/ไฟ", "โทรศัพท์", "หนี้สิน", "ธุรกิจ", "อื่น ๆ"].map((name) => ({ id: `ex:${name}`, name, type: "EXPENSE" as const })),
];
const ACCOUNT_TYPES: Record<string, string> = { เงินสด: "CASH", KBank: "BANK", SCB: "BANK", บัตรเครดิต: "CREDIT_CARD", TrueMoney: "EWALLET" };
const accounts: ParseAccount[] = Object.entries(ACCOUNT_TYPES).map(([name, type]) => ({ id: `acc:${name}`, name, type }));
const ctx = { categories, accounts };

function parse(text: string) {
  const r = parseEntry(text, ctx);
  assert.ok(r.ok, `expected "${text}" to parse`);
  return r.entry;
}

describe("parseEntry", () => {
  it("defaults to an expense and maps food keywords", () => {
    const e = parse("ข้าวกะเพรา 50");
    assert.equal(e.type, "EXPENSE");
    assert.equal(e.amount, 50);
    assert.equal(e.categoryId, "ex:อาหาร");
    assert.equal(e.description, "ข้าวกะเพรา");
    assert.equal(e.accountId, null);
    assert.equal(e.daysAgo, 0);
  });

  it("accepts the amount first and without spaces", () => {
    assert.equal(parse("120 ก๋วยเตี๋ยว").amount, 120);
    const e = parse("กาแฟ65");
    assert.equal(e.amount, 65);
    assert.equal(e.categoryId, "ex:อาหาร");
  });

  it("treats + and รับ as income and matches category names", () => {
    const a = parse("+30000 เงินเดือน");
    assert.equal(a.type, "INCOME");
    assert.equal(a.amount, 30000);
    assert.equal(a.categoryId, "in:เงินเดือน");
    const b = parse("รับ 2500 ยอดขายร้าน");
    assert.equal(b.type, "INCOME");
    assert.equal(b.categoryId, "in:รายได้ร้านครัวกะเพรา");
  });

  it("infers income from strong hints without a sign", () => {
    const e = parse("เงินเดือน 30,000");
    assert.equal(e.type, "INCOME");
    assert.equal(e.amount, 30000);
    assert.equal(parse("โบนัส 15000").categoryId, "in:โบนัส");
  });

  it("parses commas, decimals and k/พัน", () => {
    assert.equal(parse("ค่าไฟ 1,250.50").amount, 1250.5);
    assert.equal(parse("ค่าไฟ 1,250.50").categoryId, "ex:ค่าน้ำ/ไฟ");
    assert.equal(parse("grab 1.2k").amount, 1200);
    assert.equal(parse("ค่าเช่า 6พัน").amount, 6000);
    assert.equal(parse("ค่าเช่า 6พัน").categoryId, "ex:บ้าน");
  });

  it("picks the account named in the message", () => {
    const e = parse("กาแฟ 65 truemoney");
    assert.equal(e.accountId, "acc:TrueMoney");
    assert.equal(e.description, "กาแฟ");
    assert.equal(parse("shopee 890 จ่ายด้วย บัตรเครดิต").accountId, "acc:บัตรเครดิต");
  });

  it("does not read 7-11 as the amount", () => {
    const e = parse("7-11 85");
    assert.equal(e.amount, 85);
    assert.equal(e.categoryId, "ex:ช้อปปิ้ง");
  });

  it("prefers the largest number when several appear", () => {
    assert.equal(parse("กาแฟ 3 แก้ว 150").amount, 150);
    assert.equal(parse("จ่าย 50 บาท ข้าว 2 จาน").amount, 50); // มีหน่วยกำกับ
  });

  it("handles yesterday", () => {
    assert.equal(parse("เมื่อวาน น้ำมัน 500").daysAgo, 1);
    assert.equal(parse("เมื่อวาน น้ำมัน 500").categoryId, "ex:เดินทาง");
    assert.equal(parse("เมื่อวานซืน ข้าว 40").daysAgo, 2);
  });

  it("falls back to the 'other' category", () => {
    assert.equal(parse("ทำบุญ 100").categoryId, "ex:อื่น ๆ");
    assert.equal(parse("+500 เพื่อนคืนเงิน").categoryId, "in:รายได้อื่น ๆ");
  });

  it("explicit minus forces an expense even with income words", () => {
    const e = parse("-200 ค่าจ้างช่าง");
    assert.equal(e.type, "EXPENSE");
  });

  it("rejects text without an amount", () => {
    assert.deepEqual(parseEntry("สวัสดี", ctx), { ok: false, reason: "no-amount" });
    assert.deepEqual(parseEntry("ข้าว 0", ctx), { ok: false, reason: "bad-amount" });
  });
});

describe("parseTransfer", () => {
  const t = (text: string, accs = accounts) => {
    const r = parseTransfer(text, { accounts: accs });
    assert.ok(r && r.ok, `expected "${text}" to parse as transfer, got ${JSON.stringify(r)}`);
    return r.transfer;
  };

  it("ignores messages that are not transfers", () => {
    assert.equal(parseTransfer("ข้าว 50", { accounts }), null);
    assert.equal(parseTransfer("+30000 เงินเดือน", { accounts }), null);
  });

  it("reads from → to in message order", () => {
    const x = t("โอน 1000 kbank truemoney");
    assert.equal(x.amount, 1000);
    assert.equal(x.fromId, "acc:KBank");
    assert.equal(x.toId, "acc:TrueMoney");
    assert.equal(x.fromDefault, false);
  });

  it("respects direction words", () => {
    const x = t("โอนเข้า scb 500 จาก kbank");
    assert.equal(x.fromId, "acc:KBank");
    assert.equal(x.toId, "acc:SCB");
    const y = t("โอนเงิน 2,500 จาก TrueMoney ไป เงินสด ค่าขนม");
    assert.equal(y.amount, 2500);
    assert.equal(y.fromId, "acc:TrueMoney");
    assert.equal(y.toId, "acc:เงินสด");
    assert.equal(y.description, "ค่าขนม");
  });

  it("leaves missing accounts for the user to pick", () => {
    const x = t("โอน 1000");
    assert.equal(x.fromId, null);
    assert.equal(x.toId, null);
    const y = t("โอน 300 ไป scb");
    assert.equal(y.fromId, null);
    assert.equal(y.toId, "acc:SCB");
  });

  it("withdraw goes to the cash account", () => {
    const x = t("ถอน 3000 kbank");
    assert.equal(x.fromId, "acc:KBank");
    assert.equal(x.toId, "acc:เงินสด");
    const y = t("ถอนเงิน 500");
    assert.equal(y.fromId, null);
    assert.equal(y.fromDefault, true);
  });

  it("deposit comes from the cash account", () => {
    const x = t("ฝาก 2000 scb");
    assert.equal(x.fromId, "acc:เงินสด");
    assert.equal(x.toId, "acc:SCB");
  });

  it("card payment goes to the credit card", () => {
    const x = t("จ่ายบัตร 5,000 kbank");
    assert.equal(x.toId, "acc:บัตรเครดิต");
    assert.equal(x.fromId, "acc:KBank");
    const y = t("จ่ายบัตรเครดิต 1.5k");
    assert.equal(y.amount, 1500);
    assert.equal(y.fromDefault, true);
  });

  it("reports problems", () => {
    assert.deepEqual(parseTransfer("โอน kbank scb", { accounts }), { ok: false, reason: "no-amount" });
    assert.deepEqual(parseTransfer("โอน 100 kbank ไป kbank", { accounts }), { ok: false, reason: "same-account" });
    const noCard = accounts.filter((a) => a.type !== "CREDIT_CARD");
    assert.deepEqual(parseTransfer("จ่ายบัตร 500", { accounts: noCard }), { ok: false, reason: "no-card-account" });
  });

  it("treats paying someone as an expense, not a transfer", () => {
    assert.equal(parseTransfer("โอนค่าเช่า 6000", { accounts }), null);
    assert.equal(parseTransfer("โอนให้แม่ 2000", { accounts }), null);
    assert.equal(parseEntry("โอนค่าเช่า 6000", ctx).ok && (parseEntry("โอนค่าเช่า 6000", ctx) as { entry: { categoryId: string } }).entry.categoryId, "ex:บ้าน");
    assert.ok(parseTransfer("โอนให้ scb 500 จาก kbank", { accounts })?.ok);
  });

  it("uses yesterday", () => {
    assert.equal(t("เมื่อวาน โอน 100 kbank scb").daysAgo, 1);
    assert.equal(t("โอน 100 kbank scb เมื่อวาน").daysAgo, 1);
  });
});

describe("parseDebtPayment", () => {
  const debts = [
    { id: "d:moto", name: "ผ่อนมอเตอร์ไซค์", monthly: 4500 },
    { id: "d:kys", name: "กยศ.", monthly: 1200 },
    { id: "d:iphone", name: "iPhone 16", monthly: 2100 },
  ];
  const p = (text: string, ds = debts) => parseDebtPayment(text, { debts: ds });

  it("ignores ordinary messages and users without debts", () => {
    assert.equal(p("ข้าว 50"), null);
    assert.equal(p("โอน 100 kbank scb"), null);
    assert.equal(parseDebtPayment("ผ่อน มอไซค์ 4500", { debts: [] }), null);
  });

  it("matches the debt loosely by name", () => {
    assert.deepEqual(p("ผ่อน มอเตอร์ไซค์ 4500"), { debtId: "d:moto", amount: 4500, daysAgo: 0 });
    assert.equal(p("ผ่อนมอไซค์ 4,500")?.debtId, "d:moto");
    assert.equal(p("จ่ายหนี้ กยศ 1200")?.debtId, "d:kys");
    assert.equal(p("ค่างวด iphone 2100")?.debtId, "d:iphone");
  });

  it("allows a missing amount (bot uses the monthly installment)", () => {
    assert.deepEqual(p("จ่ายหนี้ กยศ"), { debtId: "d:kys", amount: null, daysAgo: 0 });
  });

  it("leaves the debt unresolved when the name is unknown or missing", () => {
    assert.equal(p("ผ่อน ตู้เย็น 3000")?.debtId, null);
    assert.equal(p("จ่ายหนี้ 2000")?.debtId, null);
    assert.equal(p("จ่ายหนี้ 2000", [debts[0]])?.debtId, "d:moto"); // มีหนี้เดียว
  });

  it("supports yesterday", () => {
    assert.equal(p("เมื่อวาน ผ่อน มอไซค์ 4500")?.daysAgo, 1);
  });
});
