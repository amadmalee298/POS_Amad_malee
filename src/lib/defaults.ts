import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "./constants";

/** สร้างบัญชีเงินและหมวดหมู่เริ่มต้นให้ผู้ใช้ใหม่ */
export async function createDefaultsForUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, userId, sortOrder: i })),
  });
  await tx.category.createMany({
    data: [
      ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ ...c, userId, type: "INCOME" as const, sortOrder: i })),
      ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ ...c, userId, type: "EXPENSE" as const, sortOrder: i })),
    ],
  });
}
