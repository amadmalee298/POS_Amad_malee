"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { closeMonthAction } from "@/lib/actions/month-close";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Goal = {
  id: string;
  name: string;
  icon: string;
  target: number;
  current: number;
  account: { id: string; name: string; icon: string } | null;
  suggested: number;
};
type Account = { id: string; name: string; icon: string; balance: number };

export function MonthCloseForm({
  month,
  net,
  goals,
  accounts,
  defaultSource,
}: {
  month: string;
  net: number;
  goals: Goal[];
  accounts: Account[];
  defaultSource: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [source, setSource] = useState(defaultSource ?? "");
  const [error, setError] = useState<string | null>(null);

  const available = Math.max(0, net);
  const sum = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0),
    [amounts],
  );
  const carry = Math.round((available - sum) * 100) / 100;
  const over = carry < 0;
  const hasSuggestion = goals.some((g) => g.suggested > 0);
  const sourceAcc = accounts.find((a) => a.id === source);
  const transfers = goals.filter((g) => Number(amounts[g.id]) > 0 && g.account && g.account.id !== source);

  const submit = () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("month", month);
      fd.set("sourceAccountId", source);
      for (const [id, v] of Object.entries(amounts)) if (Number(v) > 0) fd.set(`goal:${id}`, v);
      const res = await closeMonthAction(fd);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else setError(res.error);
    });

  if (net <= 0)
    return (
      <div className="grid gap-3 text-sm">
        <p>
          เดือนนี้ใช้จ่าย{net < 0 ? <>เกินรายรับ <b className="text-negative">{formatMoney(-net)}</b></> : "เท่ากับรายรับ"} จึงไม่มีเงินเหลือให้แบ่ง
          กดปิดยอดเพื่อบันทึกว่าตรวจเดือนนี้แล้ว
        </p>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
        <Button onClick={submit} disabled={pending} className="justify-self-start">
          ปิดยอดเดือนนี้
        </Button>
      </div>
    );

  return (
    <div className="grid gap-5">
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีเป้าหมาย —{" "}
          <Link href="/goals" className="text-primary underline-offset-4 hover:underline">
            สร้างเป้าหมายก่อน
          </Link>{" "}
          หรือปิดยอดโดยเก็บเงินไว้ใช้ทั้งหมด
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {hasSuggestion && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setAmounts(Object.fromEntries(goals.filter((g) => g.suggested > 0).map((g) => [g.id, String(g.suggested)])))
                }
              >
                <History /> แบ่งแบบเดือนก่อน
              </Button>
            )}
            {sum > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAmounts({})}>
                ล้าง
              </Button>
            )}
          </div>
          <ul className="grid gap-3">
            {goals.map((g) => {
              const v = amounts[g.id] ?? "";
              const willTransfer = Number(v) > 0 && g.account && g.account.id !== source;
              return (
                <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-x-3 gap-y-1">
                  <Label htmlFor={`goal-${g.id}`} className="min-w-0 flex-col items-start gap-0.5">
                    <span className="truncate">
                      {g.icon} {g.name}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatMoney(g.current, { decimals: false })} / {formatMoney(g.target, { decimals: false })}
                      {" · "}
                      {g.account ? (
                        willTransfer ? (
                          <span className="text-foreground">โอนเข้า {g.account.icon} {g.account.name}</span>
                        ) : (
                          <>เก็บที่ {g.account.icon} {g.account.name}</>
                        )
                      ) : (
                        <Link href="/goals" className="underline underline-offset-2">ยังไม่ได้ตั้งบัญชีเก็บเงิน</Link>
                      )}
                    </span>
                  </Label>
                  <Input
                    id={`goal-${g.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={v}
                    onChange={(e) => setAmounts((a) => ({ ...a, [g.id]: e.target.value }))}
                    className="tabular text-right"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {accounts.length > 0 && goals.some((g) => g.account) && (
        <div className="grid gap-1.5">
          <Label htmlFor="source">โอนเงินออกจากบัญชี</Label>
          <NativeSelect id="source" value={source} onChange={(e) => setSource(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name} ({formatMoney(a.balance, { decimals: false })})
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">เงินที่เหลือ</span>
          <span className="tabular">{formatMoney(available)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">แบ่งเข้าเป้าหมาย</span>
          <span className="tabular">{formatMoney(sum)}</span>
        </div>
        <div className={cn("flex justify-between border-t pt-1.5 font-semibold", over && "text-negative")}>
          <span>{over ? "แบ่งเกินเงินที่เหลือ" : "เก็บไว้ใช้ต่อ"}</span>
          <span className="tabular">{formatMoney(Math.abs(carry))}</span>
        </div>
        {transfers.length > 0 && sourceAcc && (
          <div className="mt-1 grid gap-0.5 border-t pt-1.5 text-xs text-muted-foreground">
            <span>จะสร้างรายการโอน:</span>
            {transfers.map((g) => (
              <span key={g.id} className="flex items-center gap-1">
                {sourceAcc.icon} {sourceAcc.name} <ArrowRight className="size-3" /> {g.account!.icon} {g.account!.name}{" "}
                <span className="tabular ml-auto">{formatMoney(Number(amounts[g.id]))}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={pending || over} size="lg" className="h-11">
        {pending ? "กำลังบันทึก…" : "ยืนยันปิดยอด"}
      </Button>
    </div>
  );
}
