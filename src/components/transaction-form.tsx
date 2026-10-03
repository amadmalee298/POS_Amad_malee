"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { saveTransactionAction } from "@/lib/actions/transactions";
import { formatMoney } from "@/lib/format";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";
type Account = { id: string; name: string; icon: string; balance: number };
type Category = { id: string; name: string; icon: string; type: "INCOME" | "EXPENSE" };

export type TransactionFormValues = {
  id?: string;
  type: TxType;
  amount?: number;
  date: string;
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  description?: string;
  note?: string | null;
};

const TYPES: { value: TxType; label: string; active: string }[] = [
  { value: "EXPENSE", label: "รายจ่าย", active: "bg-expense text-white" },
  { value: "INCOME", label: "รายรับ", active: "bg-income text-white" },
  { value: "TRANSFER", label: "โอนเงิน", active: "bg-foreground text-background" },
];

export function TransactionForm({
  initial,
  accounts,
  categories,
  returnTo,
}: {
  initial: TransactionFormValues;
  accounts: Account[];
  categories: Category[];
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(saveTransactionAction, undefined);
  const [type, setType] = useState<TxType>(initial.type);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const cats = categories.filter((c) => c.type === type);
  const defaultAccount = initial.accountId ?? accounts[0]?.id ?? "";

  return (
    <form action={action} className="grid gap-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="type" value={type} />

      <div className="grid grid-cols-3 rounded-xl bg-muted p-1" role="radiogroup" aria-label="ประเภทรายการ">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => {
              setType(t.value);
              setCategoryId("");
            }}
            className={cn(
              "rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors",
              type === t.value && t.active,
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="amount">จำนวนเงิน (บาท)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          autoFocus={!initial.id}
          defaultValue={initial.amount}
          placeholder="0.00"
          className="tabular h-14 text-2xl font-semibold md:text-2xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="date">วันที่</Label>
          <Input id="date" name="date" type="date" required defaultValue={initial.date} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="accountId">{type === "TRANSFER" ? "จากบัญชี" : type === "INCOME" ? "เข้าบัญชี" : "จ่ายจากบัญชี"}</Label>
          <NativeSelect id="accountId" name="accountId" required defaultValue={defaultAccount}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {type === "TRANSFER" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="toAccountId">ไปยังบัญชี</Label>
          <NativeSelect id="toAccountId" name="toAccountId" required defaultValue={initial.toAccountId ?? accounts[1]?.id ?? ""}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name} ({formatMoney(a.balance)})
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">เช่น ถอนเงินสด, โอนเข้า e-Wallet หรือจ่ายบัตรเครดิต — ไม่นับเป็นรายรับ/รายจ่าย</p>
        </div>
      ) : (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">หมวดหมู่</legend>
          <input type="hidden" name="categoryId" value={categoryId} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center text-xs transition-colors hover:bg-muted",
                  categoryId === c.id && "border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary",
                )}
              >
                <span className="text-xl leading-none">{c.icon}</span>
                <span className="line-clamp-2">{c.name}</span>
              </button>
            ))}
            <Link
              href="/categories"
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-1 py-2.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <span className="text-xl leading-none">＋</span>
              จัดการหมวด
            </Link>
          </div>
        </fieldset>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="description">รายละเอียด</Label>
        <Input
          id="description"
          name="description"
          maxLength={200}
          defaultValue={initial.description}
          placeholder={type === "EXPENSE" ? "เช่น ข้าวกะเพรา, เติมน้ำมัน" : type === "INCOME" ? "เช่น เงินเดือน ต.ค." : "เช่น จ่ายบัตรเครดิต"}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea id="note" name="note" rows={2} maxLength={1000} defaultValue={initial.note ?? ""} placeholder="(ไม่บังคับ)" />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11 flex-1" disabled={pending}>
          {pending ? "กำลังบันทึก…" : initial.id ? "บันทึกการแก้ไข" : "บันทึก"}
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11">
          <Link href={returnTo}>ยกเลิก</Link>
        </Button>
      </div>
    </form>
  );
}
