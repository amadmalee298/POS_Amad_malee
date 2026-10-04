import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { invite } = await searchParams;
  const inviteRequired = (await db.user.count()) > 0;
  return (
    <AuthForm
      mode="register"
      invite={typeof invite === "string" ? invite.slice(0, 20) : undefined}
      inviteRequired={inviteRequired}
    />
  );
}
