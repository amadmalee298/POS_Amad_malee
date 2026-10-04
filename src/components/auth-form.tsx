"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, registerAction } from "@/lib/actions/auth";

export function AuthForm({
  mode,
  invite,
  inviteRequired = true,
}: {
  mode: "login" | "register";
  invite?: string;
  inviteRequired?: boolean;
}) {
  const isLogin = mode === "login";
  const [state, action, pending] = useActionState(isLogin ? loginAction : registerAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</CardTitle>
        <CardDescription>
          {isLogin
            ? "ยินดีต้อนรับกลับมา"
            : inviteRequired
              ? "ต้องมีรหัสเชิญจากผู้ดูแลระบบ"
              : "คุณเป็นผู้ใช้คนแรก จะได้สิทธิ์ผู้ดูแลระบบ"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          {!isLogin && inviteRequired && (
            <div className="grid gap-1.5">
              <Label htmlFor="invite">รหัสเชิญ</Label>
              <Input
                id="invite"
                name="invite"
                required
                defaultValue={invite}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="XXXX-XXXX"
                className="font-mono tracking-wider uppercase"
              />
            </div>
          )}
          {!isLogin && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">ชื่อ</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              required
            />
            {!isLogin && <p className="text-xs text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>}
          </div>
          {state?.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "กำลังดำเนินการ…" : isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "ยังไม่มีบัญชี? " : "มีบัญชีแล้ว? "}
            <Link href={isLogin ? "/register" : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
              {isLogin ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
