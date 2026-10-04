"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, Plus, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { createInviteAction, revokeInviteAction } from "@/lib/actions/invites";
import { formatInviteCode } from "@/lib/invite-code";
import { cn } from "@/lib/utils";

export type InviteRow = {
  code: string;
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  expired: boolean;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

function inviteLink(code: string) {
  return `${window.location.origin}/register?invite=${formatInviteCode(code)}`;
}

function ShareButtons({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const text = () => `สมัครใช้แอปบัญชีส่วนตัว\n${inviteLink(code)}\nรหัสเชิญ: ${formatInviteCode(code)}`;
  return (
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="คัดลอกลิงก์เชิญ"
        onClick={async () => {
          await navigator.clipboard.writeText(text());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="แชร์ลิงก์เชิญ"
          onClick={() => navigator.share({ text: text() }).catch(() => {})}
        >
          <Share2 />
        </Button>
      )}
    </div>
  );
}

export function InviteManager({ invites }: { invites: InviteRow[] }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  const create = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("note", note);
      const res = await createInviteAction(fd);
      if (res.ok) {
        toast.success(res.message);
        setNote("");
      } else toast.error(res.error);
    });

  return (
    <div className="grid min-w-0 gap-3 text-sm [&>*]:min-w-0">
      <p className="text-muted-foreground">
        สมาชิกใหม่ต้องใช้รหัสเชิญในการสมัคร รหัสหนึ่งใช้ได้คนเดียว ภายใน 7 วัน
      </p>
      <div className="flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={60}
          placeholder="ให้ใคร (ไม่บังคับ) เช่น ภรรยา"
          aria-label="หมายเหตุรหัสเชิญ"
        />
        <Button onClick={create} disabled={pending} className="shrink-0">
          <Plus /> สร้างรหัส
        </Button>
      </div>

      {invites.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {invites.map((inv) => {
            const used = Boolean(inv.usedAt);
            const expired = !used && inv.expired;
            return (
              <li key={inv.code} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className={cn("font-mono font-semibold tracking-wider", (used || expired) && "text-muted-foreground line-through")}>
                    {formatInviteCode(inv.code)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {inv.note && <>{inv.note} · </>}
                    {used ? (
                      <span className="text-positive">ใช้แล้วโดย {inv.usedBy ?? "(ลบบัญชีแล้ว)"}</span>
                    ) : expired ? (
                      <span>หมดอายุ {fmtDate(inv.expiresAt)}</span>
                    ) : (
                      <span>ใช้ได้ถึง {fmtDate(inv.expiresAt)}</span>
                    )}
                  </div>
                </div>
                {!used && !expired && <ShareButtons code={inv.code} />}
                {!used && (
                  <ConfirmAction
                    title={`ยกเลิกรหัส ${formatInviteCode(inv.code)}?`}
                    description="รหัสนี้จะใช้สมัครไม่ได้อีก"
                    confirmLabel="ยกเลิกรหัส"
                    action={revokeInviteAction.bind(null, inv.code)}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="ยกเลิกรหัสเชิญ">
                        <Trash2 />
                      </Button>
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
