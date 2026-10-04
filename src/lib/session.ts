import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** ผู้ใช้ปัจจุบัน (ตรวจกับฐานข้อมูลด้วย เผื่อบัญชีถูกลบไปแล้ว) */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, isAdmin: true } });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId() {
  return (await requireUser()).id;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Forbidden");
  return user;
}
