import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
