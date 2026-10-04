import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { Money } from "@/components/money";
import { BudgetDialog } from "@/components/budget-dialog";
import { ConfirmAction } from "@/components/confirm-action";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getCategories, getCategoryBreakdown, getTotals } from "@/lib/queries";
import { currentMonth, daysInMonth, formatPercent, isValidMonth, monthLabel, monthRange, todayISO } from "@/lib/format";
import { budgetStatus, budgetTone } from "@/lib/budget";
import { deleteBudgetAction } from "@/lib/actions/budgets";

export const metadata: Metadata = { title: "งบประมาณ" };

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const { start, end } = monthRange(month);

  const [budgets, categories, spentByCat, totals] = await Promise.all([
    db.budget.findMany({ where: { userId }, include: { category: true }, orderBy: { createdAt: "asc" } }),
    getCategories(userId, "EXPENSE"),
    getCategoryBreakdown(userId, start, end, "EXPENSE"),
    getTotals(userId, start, end),
  ]);
  const spentOf = new Map(spentByCat.map((s) => [s.categoryId, s.amount]));
  const overall = budgets.find((b) => b.categoryId === null);
  const perCategory = budgets.filter((b) => b.categoryId !== null);
  const unbudgeted = categories.filter((c) => !perCategory.some((b) => b.categoryId === c.id));
  const catOptions = categories.map(({ id, name, icon }) => ({ id, name, icon }));

  // วันที่เหลือในเดือน (สำหรับคำแนะนำ "ใช้ได้วันละ")
  const today = todayISO();
  const daysLeft = today.startsWith(month) ? daysInMonth(month) - Number(today.slice(8)) + 1 : null;

  return (
    <>
      <PageHeader
        title="งบประมาณ"
        description="ตั้งเพดานรายจ่ายรายเดือน รวมทั้งเดือนหรือแยกตามหมวด"
        actions={
          <>
            <MonthPicker month={month} />
            <BudgetDialog
              categories={unbudgeted.map(({ id, name, icon }) => ({ id, name, icon }))}
              trigger={
                <Button>
                  <Plus /> ตั้งงบ
                </Button>
              }
            />
          </>
        }
      />

      <Card className="mb-3">
        <CardHeader>
          <CardTitle>งบรวมทั้งเดือน</CardTitle>
          <CardDescription>{monthLabel(month)}</CardDescription>
        </CardHeader>
        <CardContent>
          {overall ? (
            <BudgetRow
              spent={totals.expense}
              budget={Number(overall.amount)}
              daysLeft={daysLeft}
              actions={
                <>
                  <BudgetDialog
                    categories={catOptions}
                    categoryId={null}
                    amount={Number(overall.amount)}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="แก้ไขงบรวม">
                        <Pencil />
                      </Button>
                    }
                  />
                  <ConfirmAction
                    title="ลบงบรวม?"
                    action={deleteBudgetAction.bind(null, overall.id)}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="ลบงบรวม">
                        <Trash2 />
                      </Button>
                    }
                  />
                </>
              }
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              ยังไม่ได้ตั้งงบรวม — ใช้ไปแล้ว <Money value={totals.expense} className="text-foreground" />
              <BudgetDialog
                categories={catOptions}
                categoryId={null}
                trigger={
                  <Button size="sm" variant="outline">
                    ตั้งงบรวม
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>งบตามหมวดหมู่</CardTitle>
          <CardDescription>{perCategory.length} หมวดที่ตั้งงบไว้</CardDescription>
        </CardHeader>
        <CardContent>
          {perCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีงบรายหมวด — กด “ตั้งงบ” เพื่อเริ่ม</p>
          ) : (
            <ul className="space-y-5">
              {perCategory
                .map((b) => ({ b, spent: spentOf.get(b.categoryId) ?? 0, amount: Number(b.amount) }))
                .sort((x, y) => y.spent / y.amount - x.spent / x.amount)
                .map(({ b, spent, amount }) => (
                  <li key={b.id}>
                    <div className="mb-1 text-sm font-medium">
                      {b.category?.icon} {b.category?.name}
                    </div>
                    <BudgetRow
                      spent={spent}
                      budget={amount}
                      daysLeft={daysLeft}
                      actions={
                        <>
                          <BudgetDialog
                            categories={catOptions}
                            categoryId={b.categoryId}
                            amount={amount}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="แก้ไขงบ">
                                <Pencil />
                              </Button>
                            }
                          />
                          <ConfirmAction
                            title={`ลบงบหมวด "${b.category?.name}"?`}
                            action={deleteBudgetAction.bind(null, b.id)}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="ลบงบ">
                                <Trash2 />
                              </Button>
                            }
                          />
                        </>
                      }
                    />
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function BudgetRow({
  spent,
  budget,
  daysLeft,
  actions,
}: {
  spent: number;
  budget: number;
  daysLeft: number | null;
  actions: React.ReactNode;
}) {
  const ratio = spent / budget;
  const status = budgetStatus(ratio);
  const left = budget - spent;
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-sm">
          <Money value={spent} className="text-base font-semibold" />{" "}
          <span className="text-muted-foreground">
            / <Money value={budget} decimals={false} />
          </span>
        </div>
        <div className="flex items-center">{actions}</div>
      </div>
      <Progress value={Math.min(100, ratio * 100)} className="mt-1.5" indicatorClassName={budgetTone(ratio)} />
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs">
        <span className={status.className}>
          {status.label} · {formatPercent(ratio * 100)}
        </span>
        <span className="text-muted-foreground">
          {left >= 0 ? (
            <>
              เหลือ <Money value={left} />
              {daysLeft && daysLeft > 0 ? (
                <>
                  {" "}
                  · ใช้ได้วันละ <Money value={left / daysLeft} decimals={false} />
                </>
              ) : null}
            </>
          ) : (
            <span className="text-negative">
              เกินงบ <Money value={-left} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
