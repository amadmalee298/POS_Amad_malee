import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CategoryDialog } from "@/components/category-dialog";
import { ConfirmAction } from "@/components/confirm-action";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getCategories } from "@/lib/queries";
import { deleteCategoryAction } from "@/lib/actions/categories";

export const metadata: Metadata = { title: "หมวดหมู่" };

export default async function CategoriesPage() {
  const userId = await requireUserId();
  const [categories, counts] = await Promise.all([
    getCategories(userId),
    db.transaction.groupBy({ by: ["categoryId"], where: { userId }, _count: true }),
  ]);
  const countOf = new Map(counts.map((c) => [c.categoryId, c._count]));

  return (
    <>
      <PageHeader title="หมวดหมู่" description="จัดกลุ่มรายรับ–รายจ่ายเพื่อดูว่าเงินมาจากไหนและไปไหน" />
      <div className="grid gap-3 lg:grid-cols-2">
        {(["EXPENSE", "INCOME"] as const).map((type) => {
          const list = categories.filter((c) => c.type === type);
          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: type === "INCOME" ? "var(--income)" : "var(--expense)" }} />
                  หมวด{type === "INCOME" ? "รายรับ" : "รายจ่าย"}
                  <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
                </CardTitle>
                <CardAction>
                  <CategoryDialog
                    type={type}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Plus /> เพิ่ม
                      </Button>
                    }
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {list.map((c) => {
                    const n = countOf.get(c.id) ?? 0;
                    return (
                      <li key={c.id} className="flex items-center gap-3 py-2">
                        <span className="w-7 text-center text-lg">{c.icon}</span>
                        <span className="flex-1 truncate text-sm">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{n} รายการ</span>
                        <CategoryDialog
                          type={type}
                          category={{ id: c.id, name: c.name, icon: c.icon, type: c.type }}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`แก้ไข ${c.name}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        <ConfirmAction
                          title={`ลบหมวด "${c.name}"?`}
                          description={
                            n > 0
                              ? `มี ${n} รายการในหมวดนี้ รายการจะยังอยู่แต่จะกลายเป็น “ไม่ระบุหมวด” และงบประมาณของหมวดนี้จะถูกลบ`
                              : "หมวดนี้ยังไม่มีรายการ"
                          }
                          action={deleteCategoryAction.bind(null, c.id)}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`ลบ ${c.name}`}>
                              <Trash2 />
                            </Button>
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
