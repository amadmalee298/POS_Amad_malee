import Link from "next/link";
import type { CategorySlice } from "@/lib/queries";
import { formatMoney, formatPercent } from "@/lib/format";

/** รายการหมวดหมู่เรียงจากมากไปน้อย พร้อมแถบสัดส่วน */
export function CategoryBreakdown({
  data,
  color = "var(--expense)",
  limit = 7,
  hrefFor,
  empty = "ยังไม่มีข้อมูลในช่วงนี้",
}: {
  data: CategorySlice[];
  color?: string;
  limit?: number;
  hrefFor?: (categoryId: string | null) => string;
  empty?: string;
}) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;

  let rows = data;
  if (rows.length > limit) {
    const rest = rows.slice(limit - 1);
    rows = [
      ...rows.slice(0, limit - 1),
      {
        categoryId: "__rest",
        name: `อื่น ๆ (${rest.length} หมวด)`,
        icon: "•••",
        amount: rest.reduce((a, r) => a + r.amount, 0),
        count: rest.reduce((a, r) => a + r.count, 0),
        share: rest.reduce((a, r) => a + r.share, 0),
      },
    ];
  }
  const max = Math.max(...rows.map((r) => r.amount));

  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 text-center text-base leading-none">{r.icon}</span>
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatPercent(r.share)}</span>
              </span>
              <span className="tabular shrink-0 font-medium">{formatMoney(r.amount)}</span>
            </div>
            <div className="mt-1.5 ml-8 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, background: color }} />
            </div>
          </>
        );
        return (
          <li key={r.categoryId ?? "none"} className="py-2.5 first:pt-0 last:pb-0">
            {hrefFor && r.categoryId !== "__rest" ? (
              <Link href={hrefFor(r.categoryId)} className="block rounded-md hover:opacity-80">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
