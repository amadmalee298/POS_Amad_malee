"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth } from "@/lib/format";

/** ปุ่มเลื่อนเดือน ‹ ตุลาคม 2569 › — เก็บค่าไว้ใน ?month= */
export function MonthPicker({ month }: { month: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (ym: string) => {
    const p = new URLSearchParams(params);
    p.set("month", ym);
    return `${pathname}?${p}`;
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
      <Button asChild variant="ghost" size="icon-sm" aria-label="เดือนก่อน">
        <Link href={href(shiftMonth(month, -1))} scroll={false}>
          <ChevronLeft />
        </Link>
      </Button>
      <span className="min-w-28 text-center text-sm font-medium">{monthLabel(month)}</span>
      <Button asChild variant="ghost" size="icon-sm" aria-label="เดือนถัดไป">
        <Link href={href(shiftMonth(month, 1))} scroll={false}>
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}
