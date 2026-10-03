"use client";

import { useRef, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/validation";

function useSubmit(action: (fd: FormData) => Promise<ActionResult>, resetOnSuccess = false) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const submit = (fd: FormData) =>
    start(async () => {
      const res = await action(fd);
      if (res.ok) {
        toast.success(res.message);
        if (resetOnSuccess) ref.current?.reset();
      } else toast.error(res.error);
    });
  return { pending, submit, ref };
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { pending, submit } = useSubmit(updateProfileAction);
  return (
    <form action={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="name">ชื่อ</Label>
        <Input id="name" name="name" defaultValue={name} required maxLength={60} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        บันทึก
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const { pending, submit, ref } = useSubmit(changePasswordAction, true);
  return (
    <form action={submit} ref={ref} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="current">รหัสผ่านปัจจุบัน</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="next">รหัสผ่านใหม่</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <Button type="submit" disabled={pending} variant="outline" className="justify-self-start">
        เปลี่ยนรหัสผ่าน
      </Button>
    </form>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: "สว่าง", icon: Sun },
    { value: "dark", label: "มืด", icon: Moon },
    { value: "system", label: "ตามระบบ", icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm hover:bg-muted",
            theme === value && "border-primary ring-1 ring-primary",
          )}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </div>
  );
}
