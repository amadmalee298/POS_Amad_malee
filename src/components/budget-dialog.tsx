"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FormDialog } from "@/components/form-dialog";
import { saveBudgetAction } from "@/lib/actions/budgets";

type Cat = { id: string; name: string; icon: string };

export function BudgetDialog({
  trigger,
  categories,
  categoryId,
  amount,
}: {
  trigger: React.ReactNode;
  categories: Cat[];
  /** undefined = เลือกได้, null = งบรวม, string = หมวดที่ล็อกไว้ */
  categoryId?: string | null;
  amount?: number;
}) {
  const locked = categoryId !== undefined;
  const lockedName = categoryId === null ? "งบรวมทั้งเดือน" : categories.find((c) => c.id === categoryId)?.name;
  return (
    <FormDialog
      trigger={trigger}
      title={locked ? `งบประมาณ: ${lockedName}` : "ตั้งงบประมาณ"}
      description="งบประมาณต่อเดือน ใช้ซ้ำทุกเดือนจนกว่าจะแก้ไข"
      action={saveBudgetAction}
    >
      {locked ? (
        <input type="hidden" name="categoryId" value={categoryId ?? ""} />
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="budget-cat">หมวดหมู่</Label>
          <NativeSelect id="budget-cat" name="categoryId" defaultValue="">
            <option value="">💰 งบรวมทั้งเดือน</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="budget-amount">งบต่อเดือน (บาท)</Label>
        <Input id="budget-amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required defaultValue={amount} autoFocus />
      </div>
    </FormDialog>
  );
}
