"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw, Send, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { createTelegramLinkCodeAction, setupTelegramBotAction, unlinkTelegramAction } from "@/lib/actions/telegram";
import type { BotStatus } from "@/lib/telegram/setup";

type Linked = { username: string | null; firstName: string | null; linkedAt: string };

/** สถานะบอต + ปุ่มตั้งค่า webhook อัตโนมัติ */
function BotSetup({ status }: { status: BotStatus }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = () =>
    start(async () => {
      const res = await setupTelegramBotAction();
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
      router.refresh();
    });

  if (status.webhookOk)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-positive" /> บอต <b>@{status.username}</b> พร้อมใช้งาน
        </span>
        <Button variant="ghost" size="sm" onClick={run} disabled={pending}>
          <RefreshCw /> ตั้งค่าใหม่
        </Button>
        {status.lastError && (
          <p className="w-full text-xs text-warning">ข้อผิดพลาดล่าสุดจาก Telegram: {status.lastError}</p>
        )}
      </div>
    );

  return (
    <div className="grid gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          {status.username ? (
            <>
              พบบอต <b>@{status.username}</b> แล้ว แต่ยังไม่ได้เชื่อมกับเว็บนี้ — กดปุ่มด้านล่างครั้งเดียว
              {status.webhookUrl && (
                <div className="mt-1 text-xs break-all text-muted-foreground">ตอนนี้ชี้ไปที่: {status.webhookUrl}</div>
              )}
            </>
          ) : (
            "ยังไม่ได้เชื่อมบอตกับเว็บนี้"
          )}
        </div>
      </div>
      <Button onClick={run} disabled={pending} className="justify-self-start">
        <Wand2 /> {pending ? "กำลังตั้งค่า…" : "ตั้งค่าบอตอัตโนมัติ"}
      </Button>
    </div>
  );
}

export function TelegramConnect({ status, linked }: { status: BotStatus; linked: Linked | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (status.missing.length)
    return (
      <p className="text-sm text-muted-foreground">
        ยังไม่ได้ตั้งค่าใน Vercel: {status.missing.map((m) => <code key={m} className="mr-1 rounded bg-muted px-1">{m}</code>)}
        — เพิ่มใน Settings → Environment Variables แล้ว Redeploy
      </p>
    );

  if (status.problem)
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {status.problem}
      </p>
    );

  if (!status.webhookOk) return <BotSetup status={status} />;

  if (linked)
    return (
      <div className="grid gap-3">
        <BotSetup status={status} />
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
      <BotSetup status={status} />
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
