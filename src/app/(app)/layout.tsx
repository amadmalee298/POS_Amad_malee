import { BottomNav, MobileTopBar, Sidebar } from "@/components/app-nav";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
