"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatMoney, todayISO } from "@/lib/format";
import { parseEntry } from "@/lib/telegram/parse";
import { deleteTransactionAction, quickAddTransactionAction } from "@/lib/actions/transactions";

type TxType = "EXPENSE" | "INCOME";
export type QuickCategory = { id: string; name: string; icon: string; type: TxType };
export type QuickAccount = { id: string; name: string; icon: string };

const OPEN_EVENT = "quick-add:open";
const FALLBACK_NAMES = ["อื่น ๆ", "อื่นๆ", "รายได้อื่น ๆ", "รายได้อื่นๆ"];
const ACCOUNT_KEY = "quick-add:account";

/** เปิดฟอร์มบันทึกด่วนจากที่ไหนก็ได้ในแอป */
export function openQuickAdd(type: TxType = "EXPENSE") {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { type } }));
}

/** ปุ่มเปิดฟอร์มบันทึกด่วน (ใช้ในหน้า server component ได้) */
export function QuickAddTrigger({
  entryType = "EXPENSE",
  children,
  ...props
}: { entryType?: TxType } & React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" onClick={() => openQuickAdd(entryType)} {...props}>
      {children}
    </Button>
  );
}

type Saved = { id: string; type: TxType; amount: number; category: QuickCategory };

export function QuickAddSheet({
  categories,
  accounts,
  defaultAccountId,
}: {
  categories: QuickCategory[]; // เรียงตามความถี่ที่ใช้แล้ว
  accounts: QuickAccount[];
  defaultAccountId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [pending, start] = useTransition();
  // รีเฟรชข้อมูลหน้าเบื้องหลังแยกจากปุ่ม เพื่อให้กด “เสร็จแล้ว/ยกเลิก” ได้ทันที
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const amountRef = useRef<HTMLInputElement>(null);

  // เปิดจาก event (ปุ่ม + / แดชบอร์ด)
  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent<{ type?: TxType }>).detail?.type ?? "EXPENSE";
      setType(t);
      setAmount("");
      setNote("");
      setPicked(null);
      setError(null);
      setSaved(null);
      setDate(todayISO());
      try {
        const last = localStorage.getItem(ACCOUNT_KEY);
        if (last && accounts.some((a) => a.id === last)) setAccountId(last);
      } catch {
        /* storage unavailable */
      }
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [accounts]);

  const cats = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  // เดาหมวดจากบันทึกช่วยจำ (ตรรกะเดียวกับบอต Telegram) — ไม่นับหมวด “อื่น ๆ”
  const suggested = useMemo(() => {
    if (!note.trim()) return null;
    const r = parseEntry(`${type === "INCOME" ? "+" : "-"}1 ${note}`, { categories, accounts: [] });
    if (!r.ok || r.entry.type !== type || !r.entry.categoryId) return null;
    const c = categories.find((x) => x.id === r.entry.categoryId);
    return c && !FALLBACK_NAMES.includes(c.name) ? c.id : null;
  }, [note, type, categories]);

  const categoryId = picked ?? suggested ?? cats[0]?.id ?? null;
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const amountNum = Number(amount);

  const submit = () => {
    if (!(amountNum > 0)) {
      setError("กรอกจำนวนเงิน");
      amountRef.current?.focus();
      return;
    }
    if (!category) {
      setError(`ยังไม่มีหมวด${type === "INCOME" ? "รายรับ" : "รายจ่าย"} — เพิ่มได้ที่หน้าหมวดหมู่`);
      return;
    }
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("type", type);
      fd.set("amount", amount);
      fd.set("date", date || todayISO());
      fd.set("accountId", accountId);
      fd.set("categoryId", category.id);
      fd.set("description", note.trim());
      const res = await quickAddTransactionAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.setItem(ACCOUNT_KEY, accountId);
      } catch {
        /* ignore */
      }
      setSaved({ id: res.id, type, amount: Math.round(amountNum * 100) / 100, category });
      refresh();
    });
  };

  const undo = () =>
    start(async () => {
      if (!saved) return;
      const res = await deleteTransactionAction(saved.id);
      if (res.ok) {
        toast.success("ยกเลิกรายการแล้ว");
        setSaved(null); // กลับไปหน้าฟอร์ม ค่าเดิมยังอยู่ แก้แล้วบันทึกใหม่ได้
        refresh();
      } else toast.error(res.error);
    });

  const another = () => {
    setSaved(null);
    setAmount("");
    setNote("");
    setPicked(null);
    setTimeout(() => amountRef.current?.focus(), 50);
  };

  const title = saved
    ? saved.type === "INCOME"
      ? "บันทึกรายรับ"
      : "บันทึกรายจ่ายด่วน"
    : type === "INCOME"
      ? "บันทึกรายรับ"
      : "บันทึกรายจ่ายด่วน";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="pb-safe mx-auto max-h-[92dvh] w-full max-w-lg gap-0 overflow-y-auto rounded-t-3xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => amountRef.current?.focus(), 80);
        }}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted" aria-hidden />
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription className="sr-only">กรอกจำนวนเงิน เลือกหมวด แล้วกดบันทึก</SheetDescription>
        </SheetHeader>

        {saved ? (
          <div className="grid gap-3 px-4 pb-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary" strokeWidth={1.75} />
            <div className="text-xl font-semibold">บันทึกแล้ว</div>
            <p className="tabular text-muted-foreground">
              {saved.type === "INCOME"
                ? `รายรับ +${formatMoney(saved.amount)}`
                : formatMoney(saved.amount)}{" "}
              · {saved.category.icon} {saved.category.name}
            </p>
            <div className="mt-2 grid gap-2">
              <Button variant="outline" size="lg" className="h-12 rounded-xl" onClick={undo} disabled={pending}>
                ยกเลิก
              </Button>
              <Button size="lg" className="h-12 rounded-xl" onClick={() => setOpen(false)} disabled={pending}>
                เสร็จแล้ว
              </Button>
              <Button variant="ghost" onClick={another} disabled={pending}>
                <Plus /> บันทึกอีกรายการ
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-4 px-4 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ประเภท">
              {(["EXPENSE", "INCOME"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => {
                    setType(t);
                    setPicked(null);
                  }}
                  className={cn(
                    "rounded-full border py-2 text-sm font-medium text-muted-foreground transition-colors",
                    type === t && "border-primary bg-primary/10 text-foreground ring-1 ring-primary",
                  )}
                >
                  {t === "EXPENSE" ? "รายจ่าย" : "รายรับ"}
                </button>
              ))}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="qa-amount" className="text-xs text-muted-foreground">
                จำนวนเงิน
              </Label>
              <div className="flex items-baseline gap-2 border-b-2 border-foreground/80 pb-1 focus-within:border-primary">
                <span className="text-2xl font-semibold">฿</span>
                <input
                  ref={amountRef}
                  id="qa-amount"
                  type="number"
                  inputMode="decimal"
                  enterKeyHint="done"
                  step="0.01"
                  min="0.01"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  className="tabular w-full min-w-0 bg-transparent text-3xl font-semibold outline-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="qa-note" className="sr-only">
                บันทึกช่วยจำ
              </Label>
              <input
                id="qa-note"
                placeholder="บันทึกช่วยจำ"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="border-b border-border bg-transparent py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-semibold">หมวด{type === "INCOME" ? "รายรับ" : "รายจ่าย"}</legend>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={categoryId === c.id}
                    onClick={() => setPicked(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                      categoryId === c.id && "border-primary bg-primary/10 font-medium ring-1 ring-primary",
                    )}
                  >
                    <span aria-hidden>{c.icon}</span>
                    {c.name}
                  </button>
                ))}
                <Link
                  href="/categories"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  ＋ หมวด
                </Link>
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="qa-account" className="text-xs text-muted-foreground">
                  {type === "INCOME" ? "เข้าบัญชี" : "จ่ายจาก"}
                </Label>
                <NativeSelect id="qa-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="qa-date" className="text-xs text-muted-foreground">
                  วันที่
                </Label>
                <Input id="qa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="h-12 rounded-xl text-base" disabled={pending}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
            <Link
              href={`/transactions/new?type=${type}`}
              onClick={() => setOpen(false)}
              className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              โอนเงิน หรือกรอกแบบละเอียด →
            </Link>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
