import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionList } from "@/components/transaction-list";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";
import { requireUserId } from "@/lib/session";
import { getAccountsWithBalance, getCategories, getTransactions } from "@/lib/queries";
import { currentMonth, isValidMonth, monthLabel, monthRange } from "@/lib/format";

type Kind = "all" | "income" | "expense";

const TABS: { kind: Kind; href: string; label: string }[] = [
  { kind: "all", href: "/transactions", label: "ทั้งหมด" },
  { kind: "income", href: "/transactions/income", label: "รายรับ" },
  { kind: "expense", href: "/transactions/expense", label: "รายจ่าย" },
];

export async function TransactionsView({
  kind,
  searchParams,
}: {
  kind: Kind;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const userId = await requireUserId();
  const str = (k: string) => (typeof searchParams[k] === "string" ? (searchParams[k] as string) : undefined);
  const month = isValidMonth(str("month")) ? str("month")! : currentMonth();
  const { start, end } = monthRange(month);
  const type = kind === "income" ? "INCOME" : kind === "expense" ? "EXPENSE" : undefined;

  const [items, accounts, categories] = await Promise.all([
    getTransactions(userId, {
      start,
      end,
      type,
      accountId: str("account"),
      categoryId: str("category"),
      q: str("q")?.slice(0, 100),
    }),
    getAccountsWithBalance(userId, { includeArchived: true }),
    getCategories(userId, type),
  ]);

  const income = items.filter((t) => t.type === "INCOME").reduce((a, t) => a + t.amount, 0);
  const expense = items.filter((t) => t.type === "EXPENSE").reduce((a, t) => a + t.amount, 0);
  const qs = `?month=${month}`;
  const newType = kind === "income" ? "INCOME" : "EXPENSE";
  const title = kind === "income" ? "รายรับ" : kind === "expense" ? "รายจ่าย" : "รายการทั้งหมด";

  return (
    <>
      <PageHeader
        title={title}
        description={`${monthLabel(month)} · ${items.length} รายการ`}
        actions={
          <>
            <MonthPicker month={month} />
            <Button asChild className="hidden md:inline-flex">
              <Link href={`/transactions/new?type=${newType}`}>
                <Plus /> เพิ่ม{kind === "income" ? "รายรับ" : "รายการ"}
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-3 inline-flex rounded-lg bg-muted p-0.5 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.kind}
            href={t.href + qs}
            className={cn(
              "rounded-md px-4 py-1.5 text-muted-foreground transition-colors",
              t.kind === kind && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="mb-3 py-4">
        <CardContent className="space-y-3 px-4">
          <TransactionFilters
            accounts={accounts.map(({ id, name, icon }) => ({ id, name, icon }))}
            categories={categories.map(({ id, name, icon }) => ({ id, name, icon }))}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {kind !== "expense" && (
              <span>
                รายรับ <Money value={income} tone="income" className="font-semibold" />
              </span>
            )}
            {kind !== "income" && (
              <span>
                รายจ่าย <Money value={expense} className="font-semibold" />
              </span>
            )}
            {kind === "all" && (
              <span>
                สุทธิ <Money value={income - expense} tone="signed" sign className="font-semibold" />
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="px-3 md:px-5">
          <TransactionList items={items} empty="ไม่พบรายการตามเงื่อนไขนี้" />
        </CardContent>
      </Card>
    </>
  );
}
