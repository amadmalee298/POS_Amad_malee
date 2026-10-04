"use client";

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
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid gap-1.5">
        <Label htmlFor="acc-name">ชื่อบัญชี</Label>
        <Input id="acc-name" name="name" required maxLength={60} defaultValue={account?.name} placeholder="เช่น KBank ออมทรัพย์" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="acc-type">ประเภท</Label>
        <NativeSelect id="acc-type" name="type" defaultValue={account?.type ?? "BANK"}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="acc-initial">ยอดเริ่มต้น (บาท)</Label>
        <Input
          id="acc-initial"
          name="initialBalance"
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={account?.initialBalance ?? 0}
        />
        <p className="text-xs text-muted-foreground">ยอดเงินก่อนเริ่มบันทึก — บัตรเครดิตที่มียอดค้างให้ใส่ค่าติดลบ</p>
      </div>
      <EmojiField defaultValue={account?.icon ?? "🏦"} />
    </FormDialog>
  );
}
