/**
 * ข้อมูลตัวอย่างสำหรับทดลองใช้งาน
 *   npm run db:seed   →  demo@example.com / demo1234
 * (ลบข้อมูลของผู้ใช้ demo เดิมทิ้งแล้วสร้างใหม่ทุกครั้ง)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_ACCOUNTS, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../src/lib/constants";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const EMAIL = "demo@example.com";
const PASSWORD = "demo1234";

// ตัวสุ่มแบบกำหนดค่าได้ ให้ผลเหมือนเดิมทุกครั้ง
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

async function main() {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { name: "อามัด", email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 10) },
  });
  const userId = user.id;

  const initial: Record<string, number> = { เงินสด: 3000, KBank: 45000, SCB: 20000, บัตรเครดิต: 0, TrueMoney: 500 };
  for (const [i, a] of DEFAULT_ACCOUNTS.entries())
    await db.account.create({ data: { ...a, userId, sortOrder: i, initialBalance: initial[a.name] ?? 0 } });
  await db.category.createMany({
    data: [
      ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ ...c, userId, type: "INCOME" as const, sortOrder: i })),
      ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ ...c, userId, type: "EXPENSE" as const, sortOrder: i })),
    ],
  });

  const acc = Object.fromEntries((await db.account.findMany({ where: { userId } })).map((a) => [a.name, a.id]));
  const cat = Object.fromEntries((await db.category.findMany({ where: { userId } })).map((c) => [`${c.type}:${c.name}`, c.id]));
  const inc = (n: string) => cat[`INCOME:${n}`];
  const exp = (n: string) => cat[`EXPENSE:${n}`];

  type Tx = {
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount: number;
    date: Date;
    accountId: string;
    toAccountId?: string;
    categoryId?: string;
    description: string;
  };
  const txs: Tx[] = [];
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  for (let m = 5; m >= 0; m--) {
    const y = now.getFullYear();
    const mo = now.getMonth() - m;
    const d = (day: number) => new Date(Date.UTC(y, mo, day));
    const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const add = (t: Tx) => {
      if (t.date.getTime() <= todayUTC) txs.push(t);
    };

    add({ type: "INCOME", amount: 30000, date: d(1), accountId: acc.KBank, categoryId: inc("เงินเดือน"), description: "เงินเดือน" });
    // รายได้ร้านครัวกะเพรา ทุกสัปดาห์
    for (let w = 0; w < 4; w++)
      add({ type: "INCOME", amount: between(2500, 5000), date: d(5 + w * 7), accountId: acc.SCB, categoryId: inc("รายได้ร้านครัวกะเพรา"), description: "ยอดขายประจำสัปดาห์" });
    if (m % 2 === 0)
      add({ type: "INCOME", amount: between(3000, 8000), date: d(18), accountId: acc.KBank, categoryId: inc("Freelance"), description: "งานออกแบบโลโก้" });
    if (m === 3) add({ type: "INCOME", amount: 15000, date: d(25), accountId: acc.KBank, categoryId: inc("โบนัส"), description: "โบนัสกลางปี" });

    add({ type: "EXPENSE", amount: 6000, date: d(3), accountId: acc.KBank, categoryId: exp("บ้าน"), description: "ค่าเช่าห้อง" });
    add({ type: "EXPENSE", amount: between(900, 1600), date: d(10), accountId: acc.KBank, categoryId: exp("ค่าน้ำ/ไฟ"), description: "ค่าไฟ" });
    add({ type: "EXPENSE", amount: 599, date: d(12), accountId: acc.TrueMoney, categoryId: exp("โทรศัพท์"), description: "ค่าโทรศัพท์รายเดือน" });
    add({ type: "EXPENSE", amount: 4500, date: d(20), accountId: acc.KBank, categoryId: exp("หนี้สิน"), description: "ผ่อนมอเตอร์ไซค์" });
    add({ type: "EXPENSE", amount: between(2000, 4000), date: d(6), accountId: acc.SCB, categoryId: exp("ธุรกิจ"), description: "วัตถุดิบร้าน" });
    add({ type: "EXPENSE", amount: between(2000, 4000), date: d(20), accountId: acc.SCB, categoryId: exp("ธุรกิจ"), description: "วัตถุดิบร้าน" });

    for (let day = 1; day <= days; day++) {
      add({ type: "EXPENSE", amount: between(60, 160), date: d(day), accountId: acc["เงินสด"], categoryId: exp("อาหาร"), description: ["ข้าวกะเพรา", "ก๋วยเตี๋ยว", "ข้าวมันไก่", "ส้มตำ"][day % 4] });
      if (day % 2 === 0) add({ type: "EXPENSE", amount: between(40, 90), date: d(day), accountId: acc.TrueMoney, categoryId: exp("อาหาร"), description: "กาแฟ" });
      if (day % 4 === 1) add({ type: "EXPENSE", amount: between(300, 600), date: d(day), accountId: acc.KBank, categoryId: exp("เดินทาง"), description: "น้ำมัน" });
    }
    add({ type: "EXPENSE", amount: between(800, 3500), date: d(14), accountId: acc["บัตรเครดิต"], categoryId: exp("ช้อปปิ้ง"), description: "Shopee" });
    add({ type: "EXPENSE", amount: between(500, 2500), date: d(26), accountId: acc["บัตรเครดิต"], categoryId: exp("ช้อปปิ้ง"), description: "Lazada" });
    add({ type: "EXPENSE", amount: between(200, 800), date: d(22), accountId: acc["เงินสด"], categoryId: exp("อื่น ๆ"), description: "ทำบุญ" });

    add({ type: "TRANSFER", amount: 3000, date: d(2), accountId: acc.KBank, toAccountId: acc["เงินสด"], description: "ถอนเงินสด" });
    add({ type: "TRANSFER", amount: 1800, date: d(2), accountId: acc.KBank, toAccountId: acc.TrueMoney, description: "เติม TrueMoney" });
    add({ type: "TRANSFER", amount: 3000, date: d(15), accountId: acc.KBank, toAccountId: acc["บัตรเครดิต"], description: "จ่ายบัตรเครดิต" });
  }

  await db.transaction.createMany({ data: txs.map((t) => ({ ...t, userId })) });

  await db.budget.createMany({
    data: [
      { userId, categoryId: null, amount: 28000 },
      { userId, categoryId: exp("อาหาร"), amount: 5500 },
      { userId, categoryId: exp("เดินทาง"), amount: 3500 },
      { userId, categoryId: exp("ช้อปปิ้ง"), amount: 3000 },
    ],
  });

  await db.goal.createMany({
    data: [
      { userId, name: "เงินสำรองฉุกเฉิน", icon: "🛡️", targetAmount: 100000, currentAmount: 62500 },
      { userId, name: "ซื้อรถ", icon: "🚘", targetAmount: 300000, currentAmount: 85000, targetDate: new Date(Date.UTC(now.getFullYear() + 2, 11, 31)) },
      { userId, name: "เที่ยวญี่ปุ่น", icon: "✈️", targetAmount: 45000, currentAmount: 12000, targetDate: new Date(Date.UTC(now.getFullYear() + 1, 3, 1)) },
    ],
  });

  console.log(`Seeded ${txs.length} transactions → ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
