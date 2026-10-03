"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { createTelegramLinkCodeAction, unlinkTelegramAction } from "@/lib/actions/telegram";

type Linked = { username: string | null; firstName: string | null; linkedAt: string };

export function TelegramConnect({ configured, linked }: { configured: boolean; linked: Linked | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!configured)
    return (
      <p className="text-sm text-muted-foreground">
        ผู้ดูแลระบบยังไม่ได้ตั้งค่า Telegram bot (ต้องมี <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_BOT_USERNAME</code> และ{" "}
        <code>TELEGRAM_WEBHOOK_SECRET</code>) — ดูขั้นตอนใน README
      </p>
    );

  if (linked)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="flex items-center gap-1.5 font-medium text-positive">
            <Check className="size-4" /> เชื่อมต่อแล้ว
          </div>
          <div className="text-muted-foreground">
            {linked.username ? `@${linked.username}` : linked.firstName ?? "Telegram"} · ตั้งแต่{" "}
            {new Date(linked.linkedAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
          </div>
        </div>
        <ConfirmAction
          title="ยกเลิกการเชื่อมต่อ Telegram?"
          description="บอตจะหยุดรับรายการจากแชตนี้ รายการที่บันทึกไปแล้วยังอยู่ครบ"
          confirmLabel="ยกเลิกการเชื่อมต่อ"
          action={unlinkTelegramAction}
          trigger={<Button variant="outline">ยกเลิกการเชื่อมต่อ</Button>}
        />
      </div>
    );

  const generate = () =>
    start(async () => {
      const res = await createTelegramLinkCodeAction();
      if (res.ok) setCode({ code: res.code, url: res.url });
      else toast.error(res.error);
    });

  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">
        เชื่อมต่อแล้วพิมพ์ในแชต เช่น <code className="rounded bg-muted px-1">ข้าวกะเพรา 50</code> หรือ{" "}
        <code className="rounded bg-muted px-1">+30000 เงินเดือน</code> ระบบจะบันทึกให้ทันที
      </p>
      {!code ? (
        <Button onClick={generate} disabled={pending} className="justify-self-start">
          <Send /> เชื่อมต่อ Telegram
        </Button>
      ) : (
        <div className="grid gap-2 rounded-lg border p-3">
          <Button asChild className="justify-self-start">
            <a href={code.url} target="_blank" rel="noreferrer">
              <ExternalLink /> เปิด Telegram แล้วกด Start
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            หรือส่งข้อความนี้ให้บอต (ลิงก์ใช้ได้ 15 นาที ครั้งเดียว):
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">/start {code.code}</code>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="คัดลอก"
              onClick={async () => {
                await navigator.clipboard.writeText(`/start ${code.code}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <Check /> เชื่อมต่อแล้ว — รีเฟรช
            </Button>
            <Button variant="ghost" size="sm" onClick={generate} disabled={pending}>
              <RefreshCw /> สร้างลิงก์ใหม่
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
