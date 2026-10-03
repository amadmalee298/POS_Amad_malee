import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { StatCard } from "@/components/stat-card";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { TransactionList } from "@/components/transaction-list";
import { IncomeExpenseChart } from "@/components/charts/finance-charts";
import { Money } from "@/components/money";
import { requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getAccountsWithBalance,
  getCategoryBreakdown,
  getDailySeries,
  getTotals,
  getTransactions,
} from "@/lib/queries";
import { currentMonth, formatPercent, todayISO, isValidMonth, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import { dailyChartPoints } from "@/lib/chart-data";
import { budgetTone } from "@/lib/budget";

export const metadata: Metadata = { title: "แดชบอร์ด" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { start, end } = monthRange(month);
  const prev = monthRange(shiftMonth(month, -1));

  const [totals, prevTotals, daily, categories, recent, accounts, goals, overallBudget] = await Promise.all([
    getTotals(userId, start, end),
    getTotals(userId, prev.start, prev.end),
    getDailySeries(userId, month),
    getCategoryBreakdown(userId, start, end, "EXPENSE"),
    getTransactions(userId, { start, end, take: 8 }),
    getAccountsWithBalance(userId),
    db.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 3 }),
    db.budget.findFirst({ where: { userId, categoryId: null } }),
  ]);
  const netWorth = accounts.reduce((a, x) => a + x.balance, 0);
  const budget = overallBudget ? Number(overallBudget.amount) : null;

  return (
    <>
      <PageHeader title="Dashboard" description="เดือนนี้เงินเป็นอย่างไร" actions={<MonthPicker month={month} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="รายรับ" dot="var(--income)" value={totals.income} previous={prevTotals.income} compareLabel="เดือนก่อน" />
        <StatCard label="รายจ่าย" dot="var(--expense)" value={totals.expense} previous={prevTotals.expense} goodWhenUp={false} compareLabel="เดือนก่อน" />
        <StatCard label="คงเหลือเดือนนี้" value={totals.net} previous={prevTotals.net} compareLabel="เดือนก่อน" />
        <StatCard
          label="เงินรวมทุกบัญชี"
          value={netWorth}
          hint={<span className="text-muted-foreground">{accounts.length} บัญชี</span>}
        />
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>รายรับ – รายจ่ายรายวัน</CardTitle>
          <CardDescription>{monthLabel(month)}</CardDescription>
        </CardHeader>
        <CardContent>
          <IncomeExpenseChart data={dailyChartPoints(daily, todayISO())} height={240} />
        </CardContent>
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ค่าใช้จ่ายตามหมวด</CardTitle>
            <CardDescription>
              รวม <Money value={totals.expense} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {budget != null && (
              <div className="mb-4 rounded-lg bg-muted/60 p-3">
                <div className="flex justify-between text-xs">
                  <span>งบประมาณรวม</span>
                  <span className="tabular">
                    {formatPercent((totals.expense / budget) * 100)} ของ <Money value={budget} decimals={false} />
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (totals.expense / budget) * 100)}
                  className="mt-2"
                  indicatorClassName={budgetTone(totals.expense / budget)}
                />
              </div>
            )}
            <CategoryBreakdown
              data={categories}
              empty="ยังไม่มีรายจ่ายในเดือนนี้"
              hrefFor={(id) => `/transactions/expense?month=${month}${id ? `&category=${id}` : ""}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รายการล่าสุด</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/transactions?month=${month}`}>
                  ทั้งหมด <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TransactionList
              items={recent}
              empty={
                <>
                  ยังไม่มีรายการในเดือนนี้ —{" "}
                  <Link href="/transactions/new" className="text-primary underline-offset-4 hover:underline">
                    เพิ่มรายการแรก
                  </Link>
                </>
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>บัญชีเงิน</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/accounts">
                  จัดการ <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {accounts.map((a) => (
                <li key={a.id}>
                  <Link href={`/transactions?account=${a.id}`} className="flex items-center gap-3 py-2 text-sm hover:opacity-80">
                    <span className="w-6 text-center text-base">{a.icon}</span>
                    <span className="flex-1 truncate">{a.name}</span>
                    <Money value={a.balance} tone="signed" className="font-medium" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>เป้าหมายการเงิน</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/goals">
                  ทั้งหมด <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                ยังไม่มีเป้าหมาย —{" "}
                <Link href="/goals" className="text-primary underline-offset-4 hover:underline">
                  ตั้งเป้าหมายแรก
                </Link>
              </p>
            ) : (
              <ul className="space-y-4">
                {goals.map((g) => {
                  const target = Number(g.targetAmount);
                  const current = Number(g.currentAmount);
                  const pct = target > 0 ? (current / target) * 100 : 0;
                  return (
                    <li key={g.id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          {g.icon} {g.name}
                        </span>
                        <span className="tabular shrink-0 text-xs text-muted-foreground">
                          <Money value={current} decimals={false} /> / <Money value={target} decimals={false} />
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={Math.min(100, pct)} className="flex-1" />
                        <span className="tabular w-10 text-right text-xs font-medium">{formatPercent(pct)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
