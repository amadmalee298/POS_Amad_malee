import { z } from "zod";

const money = z.coerce
  .number({ error: "กรุณากรอกจำนวนเงิน" })
  .finite()
  .refine((n) => Math.abs(n) < 1e12, "จำนวนเงินมากเกินไป")
  .transform((n) => Math.round(n * 100) / 100);

export const positiveMoney = money.refine((n) => n > 0, "จำนวนเงินต้องมากกว่า 0");
export const anyMoney = money;

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง");
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((s) => (s ? s : undefined));

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amount: positiveMoney,
    date: isoDate,
    accountId: z.string().min(1, "กรุณาเลือกบัญชี"),
    toAccountId: optionalText(64),
    categoryId: optionalText(64),
    description: z.string().trim().max(200).default(""),
    note: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.type === "TRANSFER") {
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "กรุณาเลือกบัญชีปลายทาง" });
      else if (v.toAccountId === v.accountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน" });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "กรุณาเลือกหมวดหมู่" });
    }
  });

export const accountSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อบัญชี").max(60),
  type: z.enum(["CASH", "BANK", "CREDIT_CARD", "EWALLET", "SAVINGS", "INVESTMENT", "OTHER"]),
  icon: z.string().trim().min(1).max(16),
  initialBalance: anyMoney.default(0),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อหมวดหมู่").max(60),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().trim().min(1).max(16),
});

export const budgetSchema = z.object({
  categoryId: optionalText(64),
  amount: positiveMoney,
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อเป้าหมาย").max(80),
  icon: z.string().trim().min(1).max(16),
  targetAmount: positiveMoney,
  currentAmount: anyMoney.refine((n) => n >= 0, "ต้องไม่ติดลบ").default(0),
  targetDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
  accountId: optionalText(64),
  note: optionalText(500),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(60),
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(100),
  invite: z.string().trim().max(40).optional(),
});

/** แปลง FormData → object (ช่องว่างกลายเป็น undefined) */
export function formToObject(fd: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

export function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
