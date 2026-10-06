import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Money } from "@/components/money";
import { ConfirmAction } from "@/components/confirm-action";
import { MonthCloseForm } from "@/components/month-close-form";
import { requireUserId } from "@/lib/session";
import { canCloseMonth, getCloseFormData } from "@/lib/month-close";
import { currentMonth, formatDate, isValidMonth, monthLabel, parseMonth } from "@/lib/format";
import { reopenMonthAction } from "@/lib/actions/month-close";

export const metadata: Metadata = { title: "ปิดยอดเดือน" };

export default async function MonthPage({ params }: PageProps<"/monthly/[month]">) {
  const userId = await requireUserId();
  const { month } = await params;
  if (!isValidMonth(month) || month > currentMonth()) notFound();
  const data = await getCloseFormData(userId, month);
  const { totals } = data;
  const { year, month: m } = parseMonth(month);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/monthly" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> สรุปรายเดือน
      </Link>
      <PageHeader
        title={monthLabel(month)}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/reports?year=${year}&month=${m}`}>
              ดูรายงาน <ArrowRight />
            </Link>
          </Button>
        }
      />

      <Card className="mb-4 py-3.5">
        <CardContent className="grid grid-cols-3 gap-2 px-4">
          {[
            { label: "รายรับ", value: totals.income, dot: "var(--income)" },
            { label: "รายจ่าย", value: totals.expense, dot: "var(--expense)" },
            { label: "เหลือ", value: totals.net },
          ].map((t) => (
            <div key={t.label} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {t.dot && <span className="size-2.5 rounded-[3px]" style={{ background: t.dot }} />}
                {t.label}
              </div>
              <Money
                value={t.value}
                decimals={false}
                tone={t.label === "เหลือ" ? "signed" : "plain"}
                className="block truncate text-lg font-semibold md:text-xl"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {data.close ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-positive" /> ปิดยอดแล้ว
            </CardTitle>
            <CardDescription>เมื่อ {formatDate(data.close.createdAt)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.close.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่ได้แบ่งเงินเข้าเป้าหมาย</p>
            ) : (
              <ul className="divide-y">
                {data.close.items.map((i, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.goalName}</span>
                      {i.transfer && (
                        <span className="block truncate text-xs text-muted-foreground">
                          โอน {i.transfer.from} → {i.transfer.to}
                        </span>
                      )}
                    </span>
                    <Money value={i.amount} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">เก็บไว้ใช้ต่อ</span>
              <Money
                value={Math.max(0, totals.net) - data.close.items.reduce((s, i) => s + i.amount, 0)}
                className="font-semibold"
              />
            </div>
            <ConfirmAction
              title={`ยกเลิกการปิดยอด ${monthLabel(month)}?`}
              description="รายการโอนที่สร้างตอนปิดยอดจะถูกลบ และเงินที่แบ่งเข้าเป้าหมายจะถูกหักคืน จากนั้นปิดยอดใหม่ได้"
              confirmLabel="ยกเลิกการปิดยอด"
              action={reopenMonthAction.bind(null, month)}
              trigger={
                <Button variant="outline" className="justify-self-start">
                  <Undo2 /> ยกเลิกการปิดยอด
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : !canCloseMonth(month) ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            ปิดยอดได้เมื่อจบเดือนแล้ว — บอตจะเตือนในวันที่ 1 ของเดือนถัดไป
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>แบ่งเงินที่เหลือ</CardTitle>
            <CardDescription>
              ใส่จำนวนที่จะเก็บเข้าแต่ละเป้าหมาย ส่วนที่ไม่ได้แบ่งจะเก็บไว้ใช้ต่อ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthCloseForm
              month={month}
              net={totals.net}
              goals={data.goals}
              accounts={data.accounts.filter((a) => a.type !== "CREDIT_CARD")}
              defaultSource={data.defaultSource}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
