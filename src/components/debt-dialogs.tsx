"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FormDialog } from "@/components/form-dialog";
import { EmojiField } from "@/components/emoji-field";
import { payDebtAction, saveDebtAction } from "@/lib/actions/debts";
import { formatMoney, todayISO } from "@/lib/format";

type AccountOption = { id: string; name: string; icon: string };

export type DebtFormValues = {
  id: string;
  name: string;
  icon: string;
  kind: string;
  lender: string | null;
  principal: number;
  startBalance: number;
  monthly: number | null;
  dueDay: number | null;
  interestRate: number | null;
  accountId: string | null;
  note: string | null;
};

const KINDS = [
  { value: "INSTALLMENT", label: "ผ่อนสินค้า / รถ", icon: "🛵" },
  { value: "LOAN", label: "สินเชื่อ / เงินกู้", icon: "🏦" },
  { value: "PERSONAL", label: "ยืมคน", icon: "🤝" },
  { value: "OTHER", label: "อื่น ๆ", icon: "🧾" },
];

export function DebtDialog({
  debt,
  accounts,
  trigger,
}: {
  debt?: DebtFormValues;
  accounts: AccountOption[];
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      trigger={trigger}
      title={debt ? "แก้ไขหนี้" : "เพิ่มหนี้"}
      description="ผ่อนสินค้า สินเชื่อ หรือยืมคน — บัตรเครดิตให้เพิ่มเป็นบัญชีเงินแทน"
      action={saveDebtAction}
    >
      <DebtFields debt={debt} accounts={accounts} />
    </FormDialog>
  );
}

function DebtFields({ debt, accounts }: { debt?: DebtFormValues; accounts: AccountOption[] }) {
  const [kind, setKind] = useState(debt?.kind ?? "INSTALLMENT");
  const [icon, setIcon] = useState(debt?.icon ?? "🛵");
  return (
    <>
      {debt && <input type="hidden" name="id" value={debt.id} />}
      <div className="grid gap-1.5">
        <Label htmlFor="debt-name">ชื่อหนี้</Label>
        <Input id="debt-name" name="name" required maxLength={80} defaultValue={debt?.name} placeholder="เช่น ผ่อนมอเตอร์ไซค์" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="debt-kind">ประเภท</Label>
          <NativeSelect
            id="debt-kind"
            name="kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              if (!debt) setIcon(KINDS.find((k) => k.value === e.target.value)?.icon ?? "🧾");
            }}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.icon} {k.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="debt-lender">เจ้าหนี้</Label>
          <Input id="debt-lender" name="lender" maxLength={80} defaultValue={debt?.lender ?? ""} placeholder="เช่น Honda Leasing" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="debt-principal">ยอดหนี้ทั้งหมด</Label>
          <Input id="debt-principal" name="principal" type="number" step="0.01" min="0.01" inputMode="decimal" required defaultValue={debt?.principal} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="debt-start">ยอดคงเหลือตอนนี้</Label>
          <Input id="debt-start" name="startBalance" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={debt?.startBalance} placeholder="= ยอดทั้งหมด" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">ถ้าผ่อนมาแล้วบางส่วน ให้ใส่ยอดที่เหลือจริงตอนเริ่มบันทึก</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="debt-monthly">ค่างวด / เดือน</Label>
          <Input id="debt-monthly" name="monthlyPayment" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={debt?.monthly ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="debt-due">ครบกำหนดทุกวันที่</Label>
          <Input id="debt-due" name="dueDay" type="number" min="1" max="31" inputMode="numeric" defaultValue={debt?.dueDay ?? ""} placeholder="1–31" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="debt-account">จ่ายจากบัญชี</Label>
          <NativeSelect id="debt-account" name="accountId" defaultValue={debt?.accountId ?? ""}>
            <option value="">— เลือกตอนจ่าย —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="debt-rate">ดอกเบี้ย % ต่อปี</Label>
          <Input id="debt-rate" name="interestRate" type="number" step="0.01" min="0" max="100" inputMode="decimal" defaultValue={debt?.interestRate ?? ""} placeholder="(ไม่บังคับ)" />
        </div>
      </div>
      <EmojiField key={icon} defaultValue={icon} />
      <div className="grid gap-1.5">
        <Label htmlFor="debt-note">หมายเหตุ</Label>
        <Textarea id="debt-note" name="note" rows={2} maxLength={500} defaultValue={debt?.note ?? ""} />
      </div>
    </>
  );
}

export function PayDebtDialog({
  debt,
  accounts,
  trigger,
}: {
  debt: { id: string; name: string; balance: number; monthly: number | null; accountId: string | null };
  accounts: AccountOption[];
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog trigger={trigger} title={`ชำระ ${debt.name}`} action={payDebtAction} submitLabel="บันทึกการชำระ">
      <PayFields debt={debt} accounts={accounts} />
    </FormDialog>
  );
}

function PayFields({
  debt,
  accounts,
}: {
  debt: { id: string; balance: number; monthly: number | null; accountId: string | null };
  accounts: AccountOption[];
}) {
  const suggested = debt.monthly ? Math.min(debt.monthly, debt.balance) : debt.balance;
  const [amount, setAmount] = useState(String(suggested || ""));
  const [interest, setInterest] = useState("");
  const principalPart = Math.max(0, (Number(amount) || 0) - (Number(interest) || 0));
  const after = Math.max(0, debt.balance - principalPart);
  return (
    <>
      <input type="hidden" name="debtId" value={debt.id} />
      <div className="grid gap-1.5">
        <Label htmlFor="pay-amount">ยอดที่จ่าย (บาท)</Label>
        <Input
          id="pay-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tabular h-12 text-xl font-semibold"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pay-interest">ในนั้นเป็นดอกเบี้ย</Label>
          <Input id="pay-interest" name="interest" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" value={interest} onChange={(e) => setInterest(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-date">วันที่</Label>
          <Input id="pay-date" name="date" type="date" required defaultValue={todayISO()} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pay-account">จ่ายจากบัญชี</Label>
        <NativeSelect id="pay-account" name="accountId" defaultValue={debt.accountId ?? accounts[0]?.id ?? ""} required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1 rounded-lg bg-muted/60 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">ตัดเงินต้น</span>
          <span className="tabular">{formatMoney(principalPart)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>คงเหลือหลังจ่าย</span>
          <span className="tabular">{after <= 0 ? "🎉 ปิดหนี้" : formatMoney(after)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">บันทึกเป็นรายจ่ายหมวด “หนี้สิน” จากบัญชีที่เลือก</p>
    </>
  );
}
