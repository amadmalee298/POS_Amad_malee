"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { categorySchema, firstError, formToObject, type ActionResult } from "@/lib/validation";

export async function saveCategoryAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = categorySchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const id = (fd.get("id") as string) || null;

  try {
    if (id) {
      // เปลี่ยนประเภทไม่ได้ เพราะจะทำให้รายการเดิมผิดประเภท
      const { count } = await db.category.updateMany({
        where: { id, userId },
        data: { name: parsed.data.name, icon: parsed.data.icon },
      });
      if (!count) return { ok: false, error: "ไม่พบหมวดหมู่นี้" };
    } else {
      const max = await db.category.aggregate({ where: { userId, type: parsed.data.type }, _max: { sortOrder: true } });
      await db.category.create({ data: { ...parsed.data, userId, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return { ok: false, error: "มีหมวดหมู่ชื่อนี้อยู่แล้ว" };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "แก้ไขหมวดหมู่แล้ว" : "เพิ่มหมวดหมู่แล้ว" };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.category.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: "ไม่พบหมวดหมู่นี้" };
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบหมวดหมู่แล้ว" };
}
