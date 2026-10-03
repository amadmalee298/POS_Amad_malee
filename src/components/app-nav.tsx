"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Plus,
  Settings,
  Sun,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logoutAction } from "@/lib/actions/auth";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/transactions", label: "รายการ", icon: ArrowLeftRight },
  { href: "/accounts", label: "บัญชีเงิน", icon: Wallet },
  { href: "/categories", label: "หมวดหมู่", icon: Tags },
  { href: "/budget", label: "งบประมาณ", icon: PiggyBank },
  { href: "/goals", label: "เป้าหมาย", icon: Target },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

const MORE = NAV.filter((n) => !["/dashboard", "/transactions", "/reports"].includes(n.href));

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="สลับธีมสว่าง/มืด"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function Sidebar({ user }: { user: { name: string; email: string } }) {
  const isActive = useIsActive();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
      <Link href="/dashboard" className="mb-5 flex items-center gap-2 px-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-base text-primary-foreground">฿</span>
        <span className="font-semibold">บัญชีส่วนตัว</span>
      </Link>
      <Button asChild className="mb-4 w-full" size="lg">
        <Link href="/transactions/new">
          <Plus /> เพิ่มรายการ
        </Link>
      </Button>
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              isActive(href) && "bg-sidebar-accent font-medium text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t pt-3">
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>
        <ThemeToggle />
        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit" aria-label="ออกจากระบบ">
            <LogOut />
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">฿</span>
        <span className="font-semibold">บัญชีส่วนตัว</span>
      </Link>
      <ThemeToggle className="-mr-2" />
    </header>
  );
}

export function BottomNav() {
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(m.href));

  const tab = (href: string, label: string, Icon: LucideIcon) => (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
        isActive(href) && "text-primary",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-end">
        {tab("/dashboard", "หน้าหลัก", LayoutDashboard)}
        {tab("/transactions", "รายการ", ArrowLeftRight)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/transactions/new"
            aria-label="เพิ่มรายการ"
            className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
          >
            <Plus className="size-6" />
          </Link>
        </div>
        {tab("/reports", "รายงาน", BarChart3)}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
              moreActive && "text-primary",
            )}
          >
            <Menu className="size-5" />
            เมนู
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader>
              <SheetTitle>เมนู</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-4">
              {MORE.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm",
                    isActive(href) && "border-primary text-primary",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              ))}
              <form action={logoutAction} className="contents">
                <button type="submit" className="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm text-destructive">
                  <LogOut className="size-5" />
                  ออกจากระบบ
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
