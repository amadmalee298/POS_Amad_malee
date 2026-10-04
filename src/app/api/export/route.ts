import { auth } from "@/auth";
import { getTransactions } from "@/lib/queries";
import { toISODate, todayISO } from "@/lib/format";

const TYPE_LABEL = { INCOME: "รายรับ", EXPENSE: "รายจ่าย", TRANSFER: "โอน" } as const;

/** ส่งออกรายการทั้งหมดเป็น CSV (UTF-8 BOM ให้ Excel อ่านภาษาไทยได้) */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const rows = await getTransactions(userId);
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["วันที่", "ประเภท", "จำนวนเงิน", "บัญชี", "บัญชีปลายทาง", "หมวดหมู่", "รายละเอียด", "หมายเหตุ"];
  const lines = [header, ...rows.reverse().map((t) => [
    toISODate(t.date),
    TYPE_LABEL[t.type],
    t.amount.toFixed(2),
    t.account.name,
    t.toAccount?.name ?? "",
    t.category?.name ?? "",
    t.description,
    t.note ?? "",
  ])].map((r) => r.map(q).join(","));

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
