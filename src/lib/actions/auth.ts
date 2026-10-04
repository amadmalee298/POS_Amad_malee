"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { createDefaultsForUser } from "@/lib/defaults";
import { normalizeInviteCode } from "@/lib/invite-code";
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
  const invite = normalizeInviteCode(parsed.data.invite ?? "");

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: "อีเมลนี้ถูกใช้สมัครแล้ว" };

  // ผู้ใช้คนแรกของระบบสมัครได้เลยและเป็นผู้ดูแล — คนต่อไปต้องมีรหัสเชิญ
  const isFirstUser = (await db.user.count()) === 0;
  if (!isFirstUser && !invite) return { error: "ต้องมีรหัสเชิญจากผู้ดูแลระบบจึงจะสมัครได้" };

  const passwordHash = await bcrypt.hash(password, 10);
  const INVALID = "รหัสเชิญไม่ถูกต้อง ใช้ไปแล้ว หรือหมดอายุ";
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash, isAdmin: isFirstUser } });
      if (!isFirstUser) {
        // ใช้รหัสแบบอะตอมมิก: ถ้ามีคนใช้ไปพร้อมกัน count จะเป็น 0 แล้ว rollback ทั้งหมด
        const { count } = await tx.inviteCode.updateMany({
          where: { code: invite, usedById: null, expiresAt: { gt: new Date() } },
          data: { usedById: user.id, usedAt: new Date() },
        });
        if (count !== 1) throw new Error(INVALID);
      }
      await createDefaultsForUser(tx, user.id);
    });
  } catch (err) {
    if (err instanceof Error && err.message === INVALID) return { error: INVALID };
    throw err;
  }

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
