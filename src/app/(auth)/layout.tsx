import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-2xl text-primary-foreground">฿</span>
        <h1 className="text-xl font-semibold">บัญชีส่วนตัว</h1>
        <p className="text-sm text-muted-foreground">รายรับ–รายจ่าย บัญชีเงิน งบประมาณ และเป้าหมาย ในที่เดียว</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
