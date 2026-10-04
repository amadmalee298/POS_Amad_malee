import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { AccountDialog } from "@/components/account-dialog";
import { AccountActions } from "@/components/account-actions";
import { requireUserId } from "@/lib/session";
import { getAccountsWithBalance, type AccountWithBalance } from "@/lib/queries";
import { accountTypeLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "บัญชีเงิน" };

export default async function AccountsPage() {
  const userId = await requireUserId();
  const all = await getAccountsWithBalance(userId, { includeArchived: true });
  const active = all.filter((a) => !a.archived);
  const archived = all.filter((a) => a.archived);

  const assets = active.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const debts = active.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <PageHeader
        title="บัญชีเงิน"
        description="รายการทุกรายการจะระบุว่าเงินเข้า/ออกจากบัญชีไหน"
        actions={
          <AccountDialog
            trigger={
              <Button>
                <Plus /> เพิ่มบัญชี
              </Button>
            }
          />
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="ยอดเงินสุทธิ" value={assets + debts} hint={<span className="text-muted-foreground">สินทรัพย์ − หนี้</span>} />
        <StatCard label="สินทรัพย์" value={assets} valueClassName="text-positive" />
        <StatCard label="หนี้ / ยอดค้าง" value={debts} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((a) => (
          <AccountCard key={a.id} a={a} />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-medium text-muted-foreground">บัญชีที่ซ่อนไว้</h2>
          <div className="grid gap-3 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((a) => (
              <AccountCard key={a.id} a={a} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function AccountCard({ a }: { a: AccountWithBalance }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">{a.icon}</span>
        <Link href={`/transactions?account=${a.id}`} className="min-w-0 flex-1">
          <div className="truncate font-medium">{a.name}</div>
          <div className="text-xs text-muted-foreground">{accountTypeLabel(a.type)}</div>
        </Link>
        <div className="text-right">
          <Money value={a.balance} tone="signed" className="font-semibold" />
        </div>
        <AccountActions account={a} />
      </CardContent>
    </Card>
  );
}
