import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

/** แสดงจำนวนเงิน — tone: "signed" ให้สีตามบวก/ลบ */
export function Money({
  value,
  sign,
  tone = "plain",
  decimals = true,
  className,
}: {
  value: number;
  sign?: boolean;
  tone?: "plain" | "signed" | "income" | "expense";
  decimals?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        tone === "signed" && value > 0 && "text-positive",
        tone === "signed" && value < 0 && "text-negative",
        tone === "income" && "text-positive",
        className,
      )}
    >
      {formatMoney(value, { sign, decimals })}
    </span>
  );
}
