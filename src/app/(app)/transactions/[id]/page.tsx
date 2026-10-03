import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { ConfirmAction } from "@/components/confirm-action";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getAccountsWithBalance, getCategories } from "@/lib/queries";
import { formatDate, formatMoney, toISODate } from "@/lib/format";
import { deleteTransactionAction } from "@/lib/actions/transactions";

export const metadata: Metadata = { title: "แก้ไขรายการ" };

export default async function EditTransactionPage({ params }: PageProps<"/transactions/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  const tx = await db.transaction.findFirst({ where: { id, userId } });
  if (!tx) notFound();

  const [accounts, categories] = await Promise.all([
    getAccountsWithBalance(userId, { includeArchived: true }),
    getCategories(userId),
  ]);
  const month = toISODate(tx.date).slice(0, 7);
  const returnTo = `/transactions?month=${month}`;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="แก้ไขรายการ"
        description={`${formatDate(tx.date)} · ${formatMoney(Number(tx.amount))}`}
        actions={
          <ConfirmAction
            title="ลบรายการนี้?"
            description="การลบไม่สามารถย้อนกลับได้ และยอดเงินในบัญชีจะถูกคำนวณใหม่"
            action={deleteTransactionAction.bind(null, tx.id)}
            redirectTo={returnTo}
            trigger={
              <Button variant="destructive">
                <Trash2 /> ลบ
              </Button>
            }
          />
        }
      />
      <Card>
        <CardContent>
          <TransactionForm
            initial={{
              id: tx.id,
              type: tx.type,
              amount: Number(tx.amount),
              date: toISODate(tx.date),
              accountId: tx.accountId,
              toAccountId: tx.toAccountId,
              categoryId: tx.categoryId,
              description: tx.description,
              note: tx.note,
            }}
            accounts={accounts}
            categories={categories}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
