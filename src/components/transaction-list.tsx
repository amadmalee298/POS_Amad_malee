import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { TransactionRow } from "@/lib/queries";
import { formatDate, formatMoney, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

function txTitle(t: TransactionRow) {
  if (t.type === "TRANSFER") return t.description || "โอนเงินระหว่างบัญชี";
  return t.description || t.category?.name || "ไม่ระบุหมวด";
}

function txSubtitle(t: TransactionRow) {
  if (t.type === "TRANSFER") return `${t.account.name} → ${t.toAccount?.name ?? "?"}`;
  const parts = [t.description ? t.category?.name : null, t.account.name].filter(Boolean);
  return parts.join(" · ");
}

export function TransactionItem({ t, showDate }: { t: TransactionRow; showDate?: boolean }) {
  const sign = t.type === "INCOME" ? 1 : t.type === "EXPENSE" ? -1 : 0;
  return (
    <Link
      href={`/transactions/${t.id}`}
      className="group flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/60"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full text-base",
          t.type === "INCOME" && "bg-income/12",
          t.type === "EXPENSE" && "bg-expense/12",
          t.type === "TRANSFER" && "bg-muted",
        )}
        aria-hidden
      >
        {t.type === "TRANSFER" ? "⇄" : (t.category?.icon ?? "❔")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{txTitle(t)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {showDate && <>{formatDate(t.date)} · </>}
          {txSubtitle(t)}
          {t.source === "TELEGRAM" && <> · ผ่าน Telegram</>}
        </span>
      </span>
      <span
        className={cn(
          "tabular shrink-0 text-sm font-semibold",
          sign > 0 && "text-positive",
          sign === 0 && "text-muted-foreground",
        )}
      >
        {sign === 0 ? formatMoney(t.amount) : formatMoney(sign * t.amount, { sign: true })}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </Link>
  );
}

/** รายการจัดกลุ่มตามวัน พร้อมยอดสุทธิของวัน */
export function TransactionList({ items, empty }: { items: TransactionRow[]; empty?: React.ReactNode }) {
  if (!items.length)
    return <div className="py-10 text-center text-sm text-muted-foreground">{empty ?? "ยังไม่มีรายการ"}</div>;

  const groups = new Map<string, TransactionRow[]>();
  for (const t of items) {
    const k = toISODate(t.date);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, rows]) => {
        const net = rows.reduce((a, t) => a + (t.type === "INCOME" ? t.amount : t.type === "EXPENSE" ? -t.amount : 0), 0);
        return (
          <section key={day}>
            <div className="flex items-center justify-between border-b pb-1 text-xs text-muted-foreground">
              <span className="font-medium">{formatDate(rows[0].date)}</span>
              <span className="tabular">{formatMoney(net, { sign: true })}</span>
            </div>
            <div>
              {rows.map((t) => (
                <TransactionItem key={t.id} t={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
