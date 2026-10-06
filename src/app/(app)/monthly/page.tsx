import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleDashed, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { requireUserId } from "@/lib/session";
import { getMonthlyHistory } from "@/lib/month-close";
import { formatPercent, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "สรุปรายเดือน" };

export default async function MonthlyPage() {
  const userId = await requireUserId();
  const rows = await getMonthlyHistory(userId, 12);
  const done = rows.filter((r) => !r.isCurrent && (r.income > 0 || r.expense > 0));
  const avg = done.length ? done.reduce((s, r) => s + r.net, 0) / done.length : null;
  const allocated = rows.reduce((s, r) => s + r.allocated, 0);
  const pending = done.filter((r) => !r.closed).length;

  return (
    <>
      <PageHeader title="สรุปรายเดือน" description="เงินเหลือแต่ละเดือน และแบ่งไปเป้าหมายแล้วเท่าไร" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="เหลือเฉลี่ยต่อเดือน"
          value={avg}
          hint={<span className="text-muted-foreground">จาก {done.length} เดือนที่จบแล้ว</span>}
        />
        <StatCard label="แบ่งเข้าเป้าหมายแล้ว" value={allocated} hint={<span className="text-muted-foreground">12 เดือนล่าสุด</span>} />
        <Card className="gap-1 px-4 py-3.5 md:px-5 md:py-4">
          <div className="text-xs text-muted-foreground md:text-sm">ยังไม่ปิดยอด</div>
          <div className={cn("text-xl font-semibold md:text-2xl", pending ? "text-warning" : "text-positive")}>
            {pending ? `${pending} เดือน` : "ครบแล้ว"}
          </div>
        </Card>
      </div>

      <Card className="py-2">
        <CardContent className="px-0">
          <ul className="divide-y">
            {rows.map((r) => {
              const empty = r.income === 0 && r.expense === 0;
              return (
                <li key={r.month}>
                  <Link
                    href={`/monthly/${r.month}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="w-20 shrink-0">
                      <div className="font-medium">{monthLabel(r.month, true)}</div>
                      <Status row={r} empty={empty} />
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 text-sm sm:grid-cols-4">
                      <span className="text-muted-foreground sm:text-foreground">
                        <span className="text-xs text-muted-foreground sm:hidden">รับ </span>
                        <Money value={r.income} decimals={false} />
                      </span>
                      <span className="text-right text-muted-foreground sm:text-left sm:text-foreground">
                        <span className="text-xs text-muted-foreground sm:hidden">จ่าย </span>
                        <Money value={r.expense} decimals={false} />
                      </span>
                      <span className="font-semibold">
                        <span className="text-xs font-normal text-muted-foreground sm:hidden">เหลือ </span>
                        <Money value={r.net} tone="signed" decimals={false} />
                      </span>
                      <span className="text-right text-xs text-muted-foreground sm:text-left sm:text-sm">
                        {r.rate != null ? `ออม ${formatPercent(r.rate)}` : "–"}
                      </span>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">กดที่เดือนเพื่อดูรายละเอียดหรือปิดยอด</p>
    </>
  );
}

function Status({ row, empty }: { row: { isCurrent: boolean; closed: boolean; allocated: number }; empty: boolean }) {
  if (row.isCurrent)
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" /> เดือนนี้
      </span>
    );
  if (row.closed)
    return (
      <span className="flex items-center gap-1 text-xs text-positive">
        <CheckCircle2 className="size-3" /> ปิดยอดแล้ว
      </span>
    );
  if (empty) return <span className="text-xs text-muted-foreground">ไม่มีรายการ</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-warning">
      <CircleDashed className="size-3" /> รอปิดยอด
    </span>
  );
}
