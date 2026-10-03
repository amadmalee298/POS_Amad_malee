# บัญชีส่วนตัว — Personal Finance

เว็บแอปบัญชีส่วนบุคคล: รายรับ–รายจ่าย, บัญชีเงิน, งบประมาณ, เป้าหมายการเงิน และแดชบอร์ดวิเคราะห์
ออกแบบแบบ **Mobile-first** และติดตั้งบน iPhone เป็นแอปได้ (PWA — Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม)

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma 7 · PostgreSQL · Auth.js v5 · Recharts · Vercel

## ส่วนของระบบ

| หน้า | รายละเอียด |
|---|---|
| `/login`, `/register` | เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน — ผู้ใช้ใหม่จะได้บัญชีเงินและหมวดหมู่เริ่มต้นอัตโนมัติ |
| `/dashboard` | รายรับ / รายจ่าย / คงเหลือ / เงินรวมทุกบัญชี, กราฟรายวัน, ค่าใช้จ่ายตามหมวด, รายการล่าสุด, บัญชี, เป้าหมาย |
| `/transactions` (`/income`, `/expense`) | รายการทั้งหมด กรองตามเดือน บัญชี หมวด และค้นหา |
| `/transactions/new`, `/transactions/[id]` | เพิ่ม / แก้ไข / ลบ — รายรับ, รายจ่าย, **โอนระหว่างบัญชี** |
| `/accounts` | เงินสด, ธนาคาร, บัตรเครดิต, e-Wallet ฯลฯ พร้อมยอดคงเหลือคำนวณจากรายการ |
| `/categories` | หมวดรายรับ/รายจ่าย พร้อมไอคอน |
| `/budget` | งบรวมต่อเดือนและงบรายหมวด, แจ้งเตือนใกล้/เกินงบ, “ใช้ได้วันละ” |
| `/goals` | เป้าหมายการเงิน, เพิ่ม/ถอนเงิน, เปอร์เซ็นต์ความคืบหน้า, ต้องเก็บเดือนละเท่าไร |
| `/reports` | ตัวกรอง ปี / เดือน / ทั้งหมด·รายรับ·รายจ่าย — Savings Rate, หมวดที่ใช้มากสุด, เฉลี่ยรายวัน/รายเดือน, เทียบงวดก่อน, กราฟรายรับ vs รายจ่าย, ตามหมวด, Cash Flow, แนวโน้มเงินคงเหลือ |
| `/settings` | โปรไฟล์, ธีมสว่าง/มืด, เปลี่ยนรหัสผ่าน, ส่งออก CSV |

## โครงสร้างฐานข้อมูล

`users` → `accounts`, `categories`, `transactions`, `budgets`, `goals` (ดู `prisma/schema.prisma`)

`transactions` คือหัวใจของระบบ — `type` เป็น `INCOME` / `EXPENSE` / `TRANSFER`
(การโอนใช้ `account_id` → `to_account_id` และไม่นับเป็นรายรับ/รายจ่าย)
ยอดคงเหลือของแต่ละบัญชี = ยอดเริ่มต้น + รายรับ − รายจ่าย ± การโอน

## เริ่มพัฒนาในเครื่อง

ต้องมี Node.js 20+ และ PostgreSQL

```bash
npm install
cp .env.example .env          # แก้ DATABASE_URL และ AUTH_SECRET (npx auth secret)
npm run db:migrate            # สร้างตาราง
npm run db:seed               # (ไม่บังคับ) ข้อมูลตัวอย่าง: demo@example.com / demo1234
npm run dev                   # http://localhost:3000
```

คำสั่งอื่น: `npm run lint`, `npm run typecheck`, `npm run build`

## Deploy บน Vercel

1. สร้างฐานข้อมูล PostgreSQL (เช่น Neon หรือ Supabase — มีแบบฟรี)
2. Import repo นี้ใน Vercel แล้วตั้ง Environment Variables: `DATABASE_URL`, `AUTH_SECRET`
3. รัน migration กับฐานข้อมูลจริงหนึ่งครั้ง: `DATABASE_URL=... npm run db:deploy`
4. Deploy — `npm run build` จะ `prisma generate` ให้อัตโนมัติ
