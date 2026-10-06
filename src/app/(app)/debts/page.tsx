import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { DebtDialog, PayDebtDialog } from "@/components/debt-dialogs";
import { DebtStatus } from "@/components/debt-status";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getCardDebts, getDebts, DEBT_KINDS } from "@/lib/debts";
import { formatDate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "หนี้สิน" };

export default async function DebtsPage() {
  const userId = await requireUserId();
  const [debts, cards, accountRows] = await Promise.all([
    getDebts(userId, { includeClosed: true }),
    getCardDebts(userId),
    db.account.findMany({ where: { userId, archived: false }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const accounts = accountRows.filter((a) => a.type !== "CREDIT_CARD").map(({ id, name, icon }) => ({ id, name, icon }));
  const open = debts.filter((d) => !d.closed);
  const closed = debts.filter((d) => d.closed);
  const totalOwed = open.reduce((s, d) => s + d.balance, 0) + cards.reduce((s, c) => s + c.owed, 0);
  const monthlyTotal = open.reduce((s, d) => s + (d.monthly ?? 0), 0);
  const withMonthly = open.filter((d) => d.monthly);
  const paidCount = withMonthly.filter((d) => d.status === "paid").length;
  const kindLabel = (k: string) => DEBT_KINDS.find((x) => x.value === k)?.label ?? k;

  return (
    <>
      <PageHeader
        title="หนี้สิน"
        description="ติดตามยอดคงเหลือ ค่างวด และวันครบกำหนด"
        actions={
          <DebtDialog
            accounts={accounts}
            trigger={
              <Button>
                <Plus /> เพิ่มหนี้
              </Button>
            }
          />
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="หนี้คงเหลือรวม" value={totalOwed} hint={<span className="text-muted-foreground">รวมยอดค้างบัตรเครดิต</span>} />
        <StatCard label="ค่างวดต่อเดือน" value={monthlyTotal} hint={<span className="text-muted-foreground">{withMonthly.length} รายการ</span>} />
        <Card className="col-span-2 gap-1 px-4 py-3.5 md:px-5 md:py-4 lg:col-span-1">
          <div className="text-xs text-muted-foreground md:text-sm">จ่ายงวดเดือนนี้แล้ว</div>
          <div className="text-xl font-semibold md:text-2xl">
            {paidCount} / {withMonthly.length}
          </div>
          <Progress value={withMonthly.length ? (paidCount / withMonthly.length) * 100 : 0} />
        </Card>
      </div>

      {open.length === 0 && cards.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ไม่มีหนี้ค้าง 🎉 — กด “เพิ่มหนี้” เพื่อเริ่มติดตามค่างวด เช่น ผ่อนรถ หรือสินเชื่อ
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((d) => (
            <Card key={d.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{d.icon}</span>
                  <Link href={`/debts/${d.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{d.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {kindLabel(d.kind)}
                      {d.lender && <> · {d.lender}</>}
                    </div>
                  </Link>
                  <DebtStatus status={d.status} days={d.daysToDue} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">คงเหลือ</div>
                    <Money value={d.balance} className="text-xl font-semibold" />
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    จาก <Money value={d.principal} decimals={false} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={d.paidPct} className="flex-1" />
                  <span className="tabular w-12 text-right text-xs font-medium">{formatPercent(d.paidPct)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.monthly ? <>ค่างวด <Money value={d.monthly} decimals={false} /></> : "ไม่มีค่างวดตายตัว"}
                  {d.dueDay && <> · ทุกวันที่ {d.dueDay}</>}
                  {d.monthsLeft && <> · อีก ~{d.monthsLeft} งวด</>}
                  {d.nextDue && d.status !== "paid" && <> · ครบกำหนด {formatDate(d.nextDue)}</>}
                </p>
                <div className="flex gap-2">
                  <PayDebtDialog
                    debt={{ id: d.id, name: d.name, balance: d.balance, monthly: d.monthly, accountId: d.accountId }}
                    accounts={accounts}
                    trigger={<Button className="flex-1">ชำระ</Button>}
                  />
                  <Button asChild variant="outline">
                    <Link href={`/debts/${d.id}`}>
                      ประวัติ <ChevronRight />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>บัตรเครดิต</CardTitle>
            <CardDescription>ยอดค้างจากบัญชีบัตรเครดิต — จ่ายบัตรเป็นการโอนจากบัญชีธนาคาร</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {cards.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-7 text-center text-lg">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <Money value={-c.owed} tone="signed" className="text-sm font-semibold" />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/transactions/new?type=TRANSFER&to=${c.id}&returnTo=/debts`}>จ่ายบัตร</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-medium text-muted-foreground">ปิดหนี้แล้ว</h2>
          <ul className="grid gap-2">
            {closed.map((d) => (
              <li key={d.id}>
                <Link href={`/debts/${d.id}`} className="flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm hover:bg-muted/60">
                  <span>{d.icon}</span>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-muted-foreground">
                    จ่ายรวม <Money value={d.paidTotal} decimals={false} />
                  </span>
                  <DebtStatus status="closed" days={null} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
