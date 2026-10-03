import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/format";

/** การ์ดตัวเลขหลัก พร้อมเทียบกับงวดก่อน */
export function StatCard({
  label,
  value,
  dot,
  previous,
  goodWhenUp = true,
  format = "money",
  hint,
  valueClassName,
  compareLabel = "งวดก่อน",
}: {
  label: string;
  value: number | null;
  dot?: string;
  previous?: number | null;
  goodWhenUp?: boolean;
  format?: "money" | "percent";
  hint?: React.ReactNode;
  valueClassName?: string;
  compareLabel?: string;
}) {
  const fmt = (n: number) => (format === "money" ? formatMoney(n) : formatPercent(n));
  let delta: React.ReactNode = hint;
  if (value != null && previous != null && delta === undefined) {
    if (previous === 0) delta = <span className="text-muted-foreground">ไม่มีข้อมูล{compareLabel}</span>;
    else {
      const diff = format === "percent" ? value - previous : ((value - previous) / Math.abs(previous)) * 100;
      const up = diff > 0;
      const good = Math.abs(diff) < 0.5 ? null : goodWhenUp === up;
      delta =
        good === null ? (
          <span className="text-muted-foreground">ใกล้เคียง{compareLabel}</span>
        ) : (
          <span>
            <span className={good ? "text-positive" : "text-negative"}>
              {up ? "▲" : "▼"} {format === "percent" ? `${Math.abs(diff).toFixed(0)} จุด` : formatPercent(Math.abs(diff))}
            </span>{" "}
            <span className="text-muted-foreground">จาก{compareLabel}</span>
          </span>
        );
    }
  }
  return (
    <Card className="gap-1 px-4 py-3.5 md:px-5 md:py-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground md:text-sm">
        {dot && <span className="size-2.5 rounded-[3px]" style={{ background: dot }} />}
        {label}
      </div>
      <div
        className={cn(
          "tabular truncate text-xl font-semibold tracking-tight md:text-2xl",
          value != null && value < 0 && "text-negative",
          valueClassName,
        )}
      >
        {value == null ? "–" : fmt(value)}
      </div>
      {delta !== undefined && <div className="text-xs">{delta}</div>}
    </Card>
  );
}
