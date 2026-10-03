"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { TH_MONTHS } from "@/lib/format";

const TYPES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "income", label: "รายรับ" },
  { value: "expense", label: "รายจ่าย" },
];

export function ReportFilters({ years, year, month, type }: { years: number[]; year: number; month: number | null; type: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    start(() => router.replace(`${pathname}?${p}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <NativeSelect aria-label="ปี" className="w-28" value={String(year)} onChange={(e) => set("year", e.target.value)}>
        {years.map((y) => (
          <option key={y} value={y}>
            ปี {y + 543}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="เดือน" className="w-36" value={month ? String(month) : ""} onChange={(e) => set("month", e.target.value)}>
        <option value="">ทั้งปี</option>
        {TH_MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </NativeSelect>
      <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm" role="tablist">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={type === t.value}
            onClick={() => set("type", t.value === "all" ? "" : t.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-muted-foreground",
              type === t.value && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
