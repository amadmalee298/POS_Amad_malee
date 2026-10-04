import type { Metadata } from "next";
import { Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PasswordForm, ProfileForm, ThemeSelect } from "@/components/settings-forms";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { botUsername, telegramConfigured } from "@/lib/telegram/api";
import { TelegramConnect } from "@/components/telegram-connect";
import { InviteManager } from "@/components/invite-manager";
import { logoutAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
  const user = await requireUser();
  const now = new Date();
  const [link, invites] = await Promise.all([
    db.telegramLink.findUnique({ where: { userId: user.id } }),
    user.isAdmin
      ? db.inviteCode.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { usedBy: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="ตั้งค่า" />
      <div className="grid gap-3 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>โปรไฟล์</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm name={user.name} email={user.email} />
          </CardContent>
        </Card>

        {user.isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>เชิญสมาชิก</CardTitle>
              <CardDescription>เฉพาะผู้ดูแลระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <InviteManager
                invites={invites.map((i) => ({
                  code: i.code,
                  note: i.note,
                  expiresAt: i.expiresAt.toISOString(),
                  usedAt: i.usedAt?.toISOString() ?? null,
                  usedBy: i.usedBy ? `${i.usedBy.name} (${i.usedBy.email})` : null,
                  expired: i.expiresAt < now,
                }))}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
            <CardDescription>บันทึกรายรับ–รายจ่ายผ่านแชตบอต</CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramConnect
              configured={telegramConfigured() && Boolean(botUsername())}
              linked={
                link
                  ? { username: link.username, firstName: link.firstName, linkedAt: link.createdAt.toISOString() }
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รูปแบบการแสดงผล</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSelect />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ข้อมูล</CardTitle>
            <CardDescription>ส่งออกรายการทั้งหมดเป็นไฟล์ CSV (เปิดใน Excel / Google Sheets ได้)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a href="/api/export" download>
                <Download /> ส่งออก CSV
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ติดตั้งเป็นแอปบน iPhone</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            เปิดเว็บนี้ใน Safari → กดปุ่ม <b className="text-foreground">แชร์</b> → เลือก{" "}
            <b className="text-foreground">เพิ่มไปยังหน้าจอโฮม</b> จะได้ไอคอนเปิดแบบเต็มจอเหมือนแอป
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ความปลอดภัย</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <form action={logoutAction}>
          <Button type="submit" variant="destructive" className="w-full">
            <LogOut /> ออกจากระบบ
          </Button>
        </form>
      </div>
    </div>
  );
}
