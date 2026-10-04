"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { EmojiField } from "@/components/emoji-field";
import { adjustGoalAction, saveGoalAction } from "@/lib/actions/goals";

type Goal = {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  note: string | null;
};

export function GoalDialog({ goal, trigger }: { goal?: Goal; trigger: React.ReactNode }) {
  return (
    <FormDialog trigger={trigger} title={goal ? "แก้ไขเป้าหมาย" : "เป้าหมายใหม่"} action={saveGoalAction}>
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <div className="grid gap-1.5">
        <Label htmlFor="goal-name">ชื่อเป้าหมาย</Label>
        <Input id="goal-name" name="name" required maxLength={80} defaultValue={goal?.name} placeholder="เช่น เงินสำรองฉุกเฉิน, ซื้อรถ" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-target">เป้าหมาย (บาท)</Label>
          <Input id="goal-target" name="targetAmount" type="number" step="0.01" min="0.01" inputMode="decimal" required defaultValue={goal?.targetAmount} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-current">เก็บแล้ว (บาท)</Label>
          <Input id="goal-current" name="currentAmount" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={goal?.currentAmount ?? 0} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-date">วันที่ต้องการบรรลุ (ไม่บังคับ)</Label>
        <Input id="goal-date" name="targetDate" type="date" defaultValue={goal?.targetDate ?? ""} />
      </div>
      <EmojiField defaultValue={goal?.icon ?? "🎯"} />
      <div className="grid gap-1.5">
        <Label htmlFor="goal-note">หมายเหตุ</Label>
        <Textarea id="goal-note" name="note" rows={2} maxLength={500} defaultValue={goal?.note ?? ""} />
      </div>
    </FormDialog>
  );
}

export function GoalAdjustDialog({
  goalId,
  goalName,
  direction,
  trigger,
}: {
  goalId: string;
  goalName: string;
  direction: "in" | "out";
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      trigger={trigger}
      title={direction === "in" ? `เพิ่มเงินเข้า “${goalName}”` : `ถอนเงินจาก “${goalName}”`}
      action={adjustGoalAction}
      submitLabel={direction === "in" ? "เพิ่มเงิน" : "ถอนเงิน"}
    >
      <input type="hidden" name="id" value={goalId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid gap-1.5">
        <Label htmlFor="adj-amount">จำนวนเงิน (บาท)</Label>
        <Input id="adj-amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required autoFocus />
      </div>
    </FormDialog>
  );
}
