"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/validation";

/** Dialog ที่มีฟอร์มเรียก server action แล้วปิดเองเมื่อสำเร็จ */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  submitLabel = "บันทึก",
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(fd) =>
            start(async () => {
              const res = await action(fd);
              if (res.ok) {
                toast.success(res.message ?? "บันทึกแล้ว");
                setOpen(false);
              } else setError(res.error);
            })
          }
        >
          {children}
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "กำลังบันทึก…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
