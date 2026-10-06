import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { requireUserId } from "@/lib/session";
import { getAccountsWithBalance, getCategories } from "@/lib/queries";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "เพิ่มรายการ" };

function safePath(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/transactions";
}

export default async function NewTransactionPage({ searchParams }: PageProps<"/transactions/new">) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const type = sp.type === "INCOME" || sp.type === "TRANSFER" ? sp.type : "EXPENSE";
  const [accounts, categories] = await Promise.all([getAccountsWithBalance(userId), getCategories(userId)]);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="เพิ่มรายการ" />
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm">
            ยังไม่มีบัญชีเงิน —{" "}
            <Link href="/accounts" className="text-primary underline-offset-4 hover:underline">
              สร้างบัญชีก่อน
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <TransactionForm
              initial={{
                type,
                date: todayISO(),
                toAccountId:
                  type === "TRANSFER" && typeof sp.to === "string" && accounts.some((a) => a.id === sp.to) ? sp.to : undefined,
                accountId:
                  type === "TRANSFER" && typeof sp.to === "string"
                    ? accounts.find((a) => a.id !== sp.to && a.type !== "CREDIT_CARD")?.id
                    : undefined,
              }}
              accounts={accounts}
              categories={categories}
              returnTo={safePath(sp.returnTo)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
