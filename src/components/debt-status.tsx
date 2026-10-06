import { cn } from "@/lib/utils";
import type { DueStatus } from "@/lib/debts";

/** ป้ายสถานะงวดเดือนนี้ — สี + ข้อความ (ไม่ใช้สีอย่างเดียว) */
export function DebtStatus({ status, days }: { status: DueStatus; days: number | null }) {
  const map: Record<DueStatus, { text: string; cls: string } | null> = {
    paid: { text: "✓ จ่ายเดือนนี้แล้ว", cls: "bg-positive/12 text-positive" },
    overdue: { text: `⚠ เลยกำหนด ${Math.abs(days ?? 0)} วัน`, cls: "bg-negative/12 text-negative" },
    "due-today": { text: "● ครบกำหนดวันนี้", cls: "bg-warning/15 text-warning" },
    "due-soon": { text: `● อีก ${days} วัน`, cls: "bg-warning/15 text-warning" },
    upcoming: { text: `อีก ${days} วัน`, cls: "bg-muted text-muted-foreground" },
    closed: { text: "🎉 ปิดหนี้แล้ว", cls: "bg-positive/12 text-positive" },
    none: null,
  };
  const v = map[status];
  if (!v) return null;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", v.cls)}>{v.text}</span>;
}
