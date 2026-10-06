import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { Money } from "@/components/money";
import { ConfirmAction } from "@/components/confirm-action";
import { DebtDialog, PayDebtDialog } from "@/components/debt-dialogs";
import { DebtStatus } from "@/components/debt-status";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDebts, DEBT_KINDS } from "@/lib/debts";
import { formatDate, formatPercent } from "@/lib/format";
import { deleteDebtAction, undoDebtPaymentAction } from "@/lib/actions/debts";

export const metadata: Metadata = { title: "รายละเอียดหนี้" };

export default async function DebtPage({ params }: PageProps<"/debts/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  const [all, raw, payments, accountRows] = await Promise.all([
    getDebts(userId, { includeClosed: true }),
    db.debt.findFirst({ where: { id, userId } }),
    db.debtPayment.findMany({
      where: { debtId: id, debt: { userId } },
      include: { transaction: { include: { account: { select: { name: true, icon: true } } } } },
      orderBy: { transaction: { date: "desc" } },
    }),
    db.account.findMany({ where: { userId, archived: false }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const d = all.find((x) => x.id === id);
  if (!d || !raw) notFound();
  const accounts = accountRows.filter((a) => a.type !== "CREDIT_CARD").map(({ id, name, icon }) => ({ id, name, icon }));
  const interestTotal = payments.reduce((s, p) => s + Number(p.interest), 0);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/debts" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> หนี้สิน
      </Link>
      <PageHeader
        title={`${d.icon} ${d.name}`}
        description={[DEBT_KINDS.find((k) => k.value === d.kind)?.label, d.lender].filter(Boolean).join(" · ")}
        actions={
          <>
            <DebtDialog
              accounts={accounts}
              debt={{
                id: d.id,
                name: d.name,
                icon: d.icon,
                kind: d.kind,
                lender: d.lender,
                principal: d.principal,
                startBalance: d.startBalance,
                monthly: d.monthly,
                dueDay: d.dueDay,
                interestRate: d.interestRate,
                accountId: d.accountId,
                note: d.note,
              }}
              trigger={
                <Button variant="outline" size="icon" aria-label="แก้ไขหนี้">
                  <Pencil />
                </Button>
              }
            />
            <ConfirmAction
              title={`ลบหนี้ "${d.name}"?`}
              description="ประวัติการชำระจะถูกลบ แต่รายการรายจ่ายที่จ่ายไปแล้วยังอยู่ในหน้ารายการ"
              action={deleteDebtAction.bind(null, d.id)}
              redirectTo="/debts"
              trigger={
                <Button variant="outline" size="icon" aria-label="ลบหนี้">
                  <Trash2 />
                </Button>
              }
            />
          </>
        }
      />

      <Card className="mb-3">
        <CardContent className="grid gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">คงเหลือ</div>
              <Money value={d.balance} className="text-2xl font-semibold" />
            </div>
            <DebtStatus status={d.status} days={d.daysToDue} />
          </div>
          <div className="flex items-center gap-2">
            <Progress value={d.paidPct} className="h-3 flex-1" indicatorClassName={d.closed ? "bg-positive" : undefined} />
            <span className="tabular w-12 text-right text-sm font-semibold">{formatPercent(d.paidPct)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">ยอดหนี้ทั้งหมด</dt><dd><Money value={d.principal} /></dd></div>
            <div><dt className="text-xs text-muted-foreground">จ่ายผ่านแอปแล้ว</dt><dd><Money value={d.paidTotal} /></dd></div>
            <div><dt className="text-xs text-muted-foreground">ในนั้นเป็นดอกเบี้ย</dt><dd><Money value={interestTotal} /></dd></div>
            <div><dt className="text-xs text-muted-foreground">ค่างวด</dt><dd>{d.monthly ? <Money value={d.monthly} /> : "–"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">ครบกำหนด</dt><dd>{d.dueDay ? `ทุกวันที่ ${d.dueDay}` : "–"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">งวดที่เหลือ (ประมาณ)</dt><dd>{d.monthsLeft ?? "–"}</dd></div>
          </dl>
          {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
          {!d.closed && (
            <PayDebtDialog
              debt={{ id: d.id, name: d.name, balance: d.balance, monthly: d.monthly, accountId: d.accountId }}
              accounts={accounts}
              trigger={<Button size="lg">ชำระ</Button>}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ประวัติการชำระ</CardTitle>
          <CardDescription>{payments.length} ครั้ง</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีการชำระผ่านแอป</p>
          ) : (
            <ul className="divide-y">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{formatDate(p.transaction.date)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.transaction.account.icon} {p.transaction.account.name}
                      {Number(p.interest) > 0 && <> · ดอกเบี้ย <Money value={Number(p.interest)} /></>}
                      {p.transaction.source === "TELEGRAM" && " · ผ่าน Telegram"}
                    </div>
                  </div>
                  <Money value={Number(p.transaction.amount)} className="font-semibold" />
                  <ConfirmAction
                    title="ยกเลิกการชำระนี้?"
                    description="รายการรายจ่ายนี้จะถูกลบ และยอดหนี้คงเหลือจะเพิ่มกลับ"
                    confirmLabel="ยกเลิกการชำระ"
                    action={undoDebtPaymentAction.bind(null, p.transactionId)}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="ยกเลิกการชำระ">
                        <Undo2 />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
