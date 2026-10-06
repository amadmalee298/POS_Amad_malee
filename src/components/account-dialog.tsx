"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FormDialog } from "@/components/form-dialog";
import { EmojiField } from "@/components/emoji-field";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { saveAccountAction } from "@/lib/actions/accounts";

type Account = { id: string; name: string; type: string; icon: string; initialBalance: number };

export function AccountDialog({ account, trigger }: { account?: Account; trigger: React.ReactNode }) {
  return (
    <FormDialog
      trigger={trigger}
      title={account ? "แก้ไขบัญชี" : "เพิ่มบัญชีเงิน"}
      description="เงินสด บัญชีธนาคาร บัตรเครดิต หรือ e-Wallet"
      action={saveAccountAction}
    >
      <AccountFields account={account} />
    </FormDialog>
  );
}

/** แยกเป็นคอมโพเนนต์ เพื่อให้ state เริ่มใหม่ทุกครั้งที่เปิด dialog */
function AccountFields({ account }: { account?: Account }) {
  const initial = account?.initialBalance ?? 0;
  const [type, setType] = useState(account?.type ?? "BANK");
  // แป้นตัวเลขบน iPhone ไม่มีเครื่องหมายลบ จึงเลือกบวก/ลบด้วยปุ่มแทน
  const [negative, setNegative] = useState(initial < 0);
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial)) : "");
  const signed = (negative ? -1 : 1) * (Number(amount) || 0);

  return (
    <>
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid gap-1.5">
        <Label htmlFor="acc-name">ชื่อบัญชี</Label>
        <Input id="acc-name" name="name" required maxLength={60} defaultValue={account?.name} placeholder="เช่น KBank ออมทรัพย์" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="acc-type">ประเภท</Label>
        <NativeSelect
          id="acc-type"
          name="type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            // บัตรเครดิตมักมียอดค้าง → ตั้งเป็นติดลบให้ ถ้ายังไม่ได้ใส่ยอด
            if (!amount) setNegative(e.target.value === "CREDIT_CARD");
          }}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="acc-initial">ยอดเริ่มต้น (บาท)</Label>
        <input type="hidden" name="initialBalance" value={signed} />
        <div className="flex gap-2">
          <div className="grid shrink-0 grid-cols-2 rounded-lg bg-muted p-0.5 text-sm" role="radiogroup" aria-label="ยอดบวกหรือติดลบ">
            {[
              { neg: false, label: "มีเงิน" },
              { neg: true, label: "ติดลบ" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={negative === o.neg}
                onClick={() => setNegative(o.neg)}
                className={cn(
                  "rounded-md px-3 py-1 text-muted-foreground",
                  negative === o.neg && (o.neg ? "bg-negative text-white" : "bg-background font-medium text-foreground shadow-sm"),
                )}
              >
                {o.neg ? "−" : "+"} {o.label}
              </button>
            ))}
          </div>
          <Input
            id="acc-initial"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/^-/, ""))}
            className={cn("tabular", negative && Number(amount) > 0 && "text-negative")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          ยอดเงินก่อนเริ่มบันทึก — {type === "CREDIT_CARD" ? "บัตรเครดิตที่มียอดค้างชำระ ให้เลือก “ติดลบ”" : "ถ้าเป็นยอดหนี้หรือติดลบ ให้เลือก “ติดลบ”"}
        </p>
      </div>
      <EmojiField defaultValue={account?.icon ?? "🏦"} />
    </>
  );
}
