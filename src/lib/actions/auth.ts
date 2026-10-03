"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { createDefaultsForUser } from "@/lib/defaults";
import { firstError, formToObject, registerSchema } from "@/lib/validation";

export type AuthState = { error?: string } | undefined;

export async function loginAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  try {
    await signIn("credentials", {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    throw err; // redirect
  }
}

export async function registerAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, password } = parsed.data;

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: "อีเมลนี้ถูกใช้สมัครแล้ว" };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    await createDefaultsForUser(tx, user.id);
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) return { error: "สมัครสำเร็จ แต่เข้าสู่ระบบไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง" };
    throw err;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
