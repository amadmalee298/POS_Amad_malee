import type { Metadata } from "next";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { Money } from "@/components/money";
import { GoalAdjustDialog, GoalDialog } from "@/components/goal-dialogs";
import { ConfirmAction } from "@/components/confirm-action";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { formatDate, formatMoney, formatPercent, parseISODate, toISODate, todayISO } from "@/lib/format";
import { deleteGoalAction } from "@/lib/actions/goals";

export const metadata: Metadata = { title: "เป้าหมายการเงิน" };

function monthsBetween(from: Date, to: Date) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

export default async function GoalsPage() {
  const userId = await requireUserId();
  const goals = await db.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const today = parseISODate(todayISO());

  const totalTarget = goals.reduce((a, g) => a + Number(g.targetAmount), 0);
  const totalSaved = goals.reduce((a, g) => a + Math.min(Number(g.currentAmount), Number(g.targetAmount)), 0);

  return (
    <>
      <PageHeader
        title="เป้าหมายการเงิน"
        description={
          goals.length
            ? `เก็บได้ ${formatMoney(totalSaved, { decimals: false })} จาก ${formatMoney(totalTarget, { decimals: false })} (${formatPercent(totalTarget ? (totalSaved / totalTarget) * 100 : 0)})`
            : "ตั้งเป้าหมาย แล้วติดตามความคืบหน้า"
        }
        actions={
          <GoalDialog
            trigger={
              <Button>
                <Plus /> เป้าหมายใหม่
              </Button>
            }
          />
        }
      />

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีเป้าหมาย ลองเริ่มจาก 🎯 เงินสำรองฉุกเฉิน 3–6 เท่าของรายจ่ายต่อเดือน
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            const remaining = Math.max(0, target - current);
            const pct = target > 0 ? (current / target) * 100 : 0;
            const done = current >= target;
            const months = g.targetDate ? monthsBetween(today, g.targetDate) : null;
            const perMonth = months && months > 0 && !done ? remaining / months : null;
            const overdue = g.targetDate && g.targetDate < today && !done;

            return (
              <Card key={g.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{g.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {done ? (
                          <span className="text-positive">🎉 บรรลุเป้าหมายแล้ว</span>
                        ) : g.targetDate ? (
                          <span className={overdue ? "text-negative" : ""}>
                            ภายใน {formatDate(g.targetDate)}
                            {overdue && " (เลยกำหนด)"}
                          </span>
                        ) : (
                          "ไม่กำหนดวันที่"
                        )}
                      </div>
                    </div>
                    <div className="flex">
                      <GoalDialog
                        goal={{
                          id: g.id,
                          name: g.name,
                          icon: g.icon,
                          targetAmount: target,
                          currentAmount: current,
                          targetDate: g.targetDate ? toISODate(g.targetDate) : null,
                          note: g.note,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="แก้ไขเป้าหมาย">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmAction
                        title={`ลบเป้าหมาย "${g.name}"?`}
                        action={deleteGoalAction.bind(null, g.id)}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="ลบเป้าหมาย">
                            <Trash2 />
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">เป้าหมาย</dt>
                      <dd className="font-medium">
                        <Money value={target} decimals={false} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">เก็บแล้ว</dt>
                      <dd className="font-medium text-positive">
                        <Money value={current} decimals={false} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">เหลือ</dt>
                      <dd className="font-medium">
                        <Money value={remaining} decimals={false} />
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(100, pct)} className="h-3 flex-1" indicatorClassName={done ? "bg-positive" : undefined} />
                    <span className="tabular w-14 text-right text-sm font-semibold">{pct.toFixed(1)}%</span>
                  </div>

                  {perMonth != null && (
                    <p className="text-xs text-muted-foreground">
                      ต้องเก็บเดือนละ ≈ <Money value={perMonth} decimals={false} className="font-medium text-foreground" /> อีก {months} เดือน
                    </p>
                  )}
                  {g.note && <p className="text-xs text-muted-foreground">{g.note}</p>}

                  <div className="flex gap-2">
                    <GoalAdjustDialog
                      goalId={g.id}
                      goalName={g.name}
                      direction="in"
                      trigger={
                        <Button size="sm" className="flex-1">
                          <Plus /> เพิ่มเงิน
                        </Button>
                      }
                    />
                    <GoalAdjustDialog
                      goalId={g.id}
                      goalName={g.name}
                      direction="out"
                      trigger={
                        <Button size="sm" variant="outline" className="flex-1" disabled={current <= 0}>
                          <Minus /> ถอน
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
