"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/form-dialog";
import { EmojiField } from "@/components/emoji-field";
import { saveCategoryAction } from "@/lib/actions/categories";

type Category = { id: string; name: string; icon: string; type: "INCOME" | "EXPENSE" };

export function CategoryDialog({
  category,
  type,
  trigger,
}: {
  category?: Category;
  type: "INCOME" | "EXPENSE";
  trigger: React.ReactNode;
}) {
  const typeLabel = type === "INCOME" ? "รายรับ" : "รายจ่าย";
  return (
    <FormDialog trigger={trigger} title={category ? "แก้ไขหมวดหมู่" : `เพิ่มหมวด${typeLabel}`} action={saveCategoryAction}>
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="type" value={type} />
      <div className="grid gap-1.5">
        <Label htmlFor="cat-name">ชื่อหมวดหมู่</Label>
        <Input id="cat-name" name="name" required maxLength={60} defaultValue={category?.name} />
      </div>
      <EmojiField defaultValue={category?.icon ?? (type === "INCOME" ? "💰" : "📦")} />
    </FormDialog>
  );
}
