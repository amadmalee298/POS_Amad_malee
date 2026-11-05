import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { parseISODate, todayISO } from "@/lib/format";
import { QuickAddSheet } from "@/components/quick-add-sheet";

const DAY = 86_400_000;

/** โหลดหมวด (เรียงตามที่ใช้บ่อยใน 90 วัน) และบัญชี ให้ฟอร์มบันทึกด่วน */
export async function QuickAddLoader() {
  const user = await getCurrentUser();
  if (!user) return null;
  const since = new Date(parseISODate(todayISO()).getTime() - 90 * DAY);
  const [categories, usage, accounts, link] = await Promise.all([
    db.category.findMany({ where: { userId: user.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { userId: user.id, date: { gte: since }, categoryId: { not: null } },
      _count: true,
    }),
    db.account.findMany({
      where: { userId: user.id, archived: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.telegramLink.findUnique({ where: { userId: user.id }, select: { defaultAccountId: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.categoryId, u._count]));
  const sorted = [...categories].sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0));
  const spendable = accounts.filter((a) => a.type !== "CREDIT_CARD" || accounts.length === 1);
  const defaultAccountId =
    (link?.defaultAccountId && accounts.some((a) => a.id === link.defaultAccountId) && link.defaultAccountId) ||
    spendable[0]?.id ||
    accounts[0]?.id ||
    null;

  return (
    <QuickAddSheet
      categories={sorted.map(({ id, name, icon, type }) => ({ id, name, icon, type }))}
      accounts={accounts.map(({ id, name, icon }) => ({ id, name, icon }))}
      defaultAccountId={defaultAccountId}
    />
  );
}
