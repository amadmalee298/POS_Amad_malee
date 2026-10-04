import { Suspense } from "react";
import { BottomNav, MobileTopBar, Sidebar, SidebarSkeleton } from "@/components/app-nav";
import { requireUser } from "@/lib/session";

// ข้อมูลผู้ใช้อยู่ใน <Suspense> แยก เพื่อให้ loading.tsx แสดงทันทีระหว่างเปลี่ยนหน้า
async function SidebarWithUser() {
  const user = await requireUser();
  return <Sidebar user={user} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarWithUser />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
