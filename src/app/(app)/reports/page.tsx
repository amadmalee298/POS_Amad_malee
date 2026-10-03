import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { ReportFilters } from "@/components/report-filters";
import { BalanceTrendChart, CashFlowChart, IncomeExpenseChart } from "@/components/charts/finance-charts";
import { TransactionItem } from "@/components/transaction-list";
import { Money } from "@/components/money";
import { requireUserId } from "@/lib/session";
import {
  getCategoryBreakdown,
  getDailySeries,
  getMonthlySeries,
  getTotals,
  getTransactions,
  getYearsWithData,
  savingsRate,
} from "@/lib/queries";
import {
  TH_MONTHS,
  daysInMonth,
  formatPercent,
  monthRange,
  parseISODate,
  todayISO,
  toBE,
  yearRange,
} from "@/lib/format";
import { dailyChartPoints, monthlyChartPoints } from "@/lib/chart-data";

export const metadata: Metadata = { title: "รายงาน" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));

  const yearParam = Number(sp.year);
  const year = Number.isInteger(yearParam) && yearParam >= 1900 && yearParam <= 2200 ? yearParam : thisYear;
  const monthParam = Number(sp.month);
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : null;
  const type = sp.type === "income" || sp.type === "expense" ? sp.type : "all";

  const ym = month ? `${year}-${String(month).padStart(2, "0")}` : null;
  const period = ym ? monthRange(ym) : yearRange(year);
  const prevPeriod = month
    ? monthRange(month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`)
    : yearRange(year - 1);
  const periodLabel = month ? `${TH_MONTHS[month - 1]} ${toBE(year)}` : `ปี ${toBE(year)}`;
  const prevLabel = ym ? "เดือนก่อน" : "ปีก่อน";

  const [totals, prevTotals, series, expenseCats, incomeCats, biggest, span] = await Promise.all([
    getTotals(userId, period.start, period.end),
    getTotals(userId, prevPeriod.start, prevPeriod.end),
    ym ? getDailySeries(userId, ym) : getMonthlySeries(userId, year),
    getCategoryBreakdown(userId, period.start, period.end, "EXPENSE"),
    getCategoryBreakdown(userId, period.start, period.end, "INCOME"),
    getTransactions(userId, { start: period.start, end: period.end, type: "EXPENSE" }).then((rows) =>
      [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5),
    ),
    getYearsWithData(userId),
  ]);

  const points = ym ? dailyChartPoints(series, today) : monthlyChartPoints(series, today);
  const firstYear = Math.min(span.first ?? thisYear, thisYear, year);
  const lastYear = Math.max(span.last ?? thisYear, thisYear, year);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i);

  // จำนวนวัน/เดือนที่ผ่านไปแล้วในงวด (สำหรับค่าเฉลี่ย)
  const todayDate = parseISODate(today);
  const elapsedEnd = todayDate < period.end ? new Date(todayDate.getTime() + 86_400_000) : period.end;
  const elapsedDays = Math.max(0, Math.round((elapsedEnd.getTime() - period.start.getTime()) / 86_400_000));
  const totalDays = ym ? daysInMonth(ym) : Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000);
  const days = Math.min(elapsedDays, totalDays);
  const elapsedMonths = ym ? null : year < thisYear ? 12 : year > thisYear ? 0 : Number(today.slice(5, 7));

  const rate = savingsRate(totals);
  const prevRate = savingsRate(prevTotals);
  const top = expenseCats[0];
  const showIncome = type !== "expense";
  const showExpense = type !== "income";

  return (
    <>
      <PageHeader title="รายงานและการวิเคราะห์" description={periodLabel} />
      <div className="mb-4">
        <ReportFilters years={years} year={year} month={month} type={type} />
      </div>

      <h2 className="mb-2 text-sm font-medium text-muted-foreground">ภาพรวม · เทียบกับ{prevLabel}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showIncome && <StatCard label="รายรับรวม" dot="var(--income)" value={totals.income} previous={prevTotals.income} compareLabel={prevLabel} />}
        {showExpense && (
          <StatCard label="รายจ่ายรวม" dot="var(--expense)" value={totals.expense} previous={prevTotals.expense} goodWhenUp={false} compareLabel={prevLabel} />
        )}
        <StatCard label="เงินเหลือ" value={totals.net} previous={prevTotals.net} compareLabel={prevLabel} />
        <StatCard
          label="Savings Rate"
          value={rate}
          previous={prevRate}
          compareLabel={prevLabel}
          format="percent"
          hint={rate == null ? <span className="text-muted-foreground">ไม่มีรายรับในงวดนี้</span> : undefined}
        />
      </div>

      {showExpense && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-medium text-muted-foreground">วิเคราะห์รายจ่าย</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-1 px-4 py-3.5 md:px-5 md:py-4">
              <div className="text-xs text-muted-foreground md:text-sm">หมวดที่ใช้เงินมากที่สุด</div>
              {top ? (
                <>
                  <div className="truncate text-lg font-semibold">
                    {top.icon} {top.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Money value={top.amount} /> · {formatPercent(top.share)} ของรายจ่าย
                  </div>
                </>
              ) : (
                <div className="text-lg font-semibold">–</div>
              )}
            </Card>
            <StatCard
              label="ค่าใช้จ่ายเฉลี่ยต่อวัน"
              value={days > 0 ? totals.expense / days : null}
              hint={<span className="text-muted-foreground">คิดจาก {days} วัน</span>}
            />
            <StatCard
              label={ym ? "ค่าใช้จ่ายทั้งเดือน" : "ค่าใช้จ่ายเฉลี่ยต่อเดือน"}
              value={ym ? totals.expense : elapsedMonths ? totals.expense / elapsedMonths : null}
              hint={<span className="text-muted-foreground">{ym ? `${totals.count} รายการ` : `คิดจาก ${elapsedMonths} เดือน`}</span>}
            />
            <StatCard
              label={`เทียบ${prevLabel}`}
              value={prevTotals.count > 0 ? totals.expense - prevTotals.expense : null}
              hint={
                <span className="text-muted-foreground">
                  {prevTotals.count > 0 ? (
                    <>
                      {prevLabel} <Money value={prevTotals.expense} decimals={false} />
                    </>
                  ) : (
                    `ไม่มีข้อมูล${prevLabel}`
                  )}
                </span>
              }
              valueClassName={prevTotals.count === 0 ? undefined : totals.expense - prevTotals.expense > 0 ? "text-negative" : "text-positive"}
            />
          </div>
        </>
      )}

      <h2 className="mt-6 mb-2 text-sm font-medium text-muted-foreground">กราฟ</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{type === "all" ? "รายรับ vs รายจ่าย" : type === "income" ? "รายรับ" : "รายจ่าย"}</CardTitle>
            <CardDescription>{ym ? "รายวัน" : "รายเดือน"} · {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={points} show={type === "all" ? "both" : type} />
          </CardContent>
        </Card>

        {showExpense && (
          <Card>
            <CardHeader>
              <CardTitle>รายจ่ายตามหมวด</CardTitle>
              <CardDescription>
                รวม <Money value={totals.expense} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBreakdown data={expenseCats} limit={8} />
            </CardContent>
          </Card>
        )}
        {showIncome && (
          <Card>
            <CardHeader>
              <CardTitle>รายรับตามหมวด</CardTitle>
              <CardDescription>
                รวม <Money value={totals.income} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBreakdown data={incomeCats} limit={8} color="var(--income)" />
            </CardContent>
          </Card>
        )}

        {type === "all" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow</CardTitle>
                <CardDescription>เงินเข้าสุทธิ (รายรับ − รายจ่าย) {ym ? "รายวัน" : "รายเดือน"}</CardDescription>
              </CardHeader>
              <CardContent>
                <CashFlowChart data={points} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>แนวโน้มเงินคงเหลือ</CardTitle>
                <CardDescription>ยอดเงินรวมทุกบัญชี ณ สิ้น{ym ? "วัน" : "เดือน"}</CardDescription>
              </CardHeader>
              <CardContent>
                <BalanceTrendChart data={points} />
              </CardContent>
            </Card>
          </>
        )}

        {showExpense && biggest.length > 0 && (
          <Card className={type === "all" ? "lg:col-span-2" : ""}>
            <CardHeader>
              <CardTitle>รายจ่ายก้อนใหญ่ที่สุด</CardTitle>
              <CardDescription>5 อันดับใน{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {biggest.map((t) => (
                <TransactionItem key={t.id} t={t} showDate />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
