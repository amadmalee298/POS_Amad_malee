"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountDialog } from "@/components/account-dialog";
import { ConfirmAction } from "@/components/confirm-action";
import { deleteAccountAction, setAccountArchivedAction } from "@/lib/actions/accounts";

type Props = {
  account: { id: string; name: string; type: string; icon: string; initialBalance: number; archived: boolean };
};

export function AccountActions({ account }: Props) {
  const [, start] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex">
      <AccountDialog
        account={account}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="แก้ไขบัญชี">
            <Pencil />
          </Button>
        }
      />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="ตัวเลือกเพิ่มเติม">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const res = await setAccountArchivedAction(account.id, !account.archived);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            {account.archived ? <ArchiveRestore /> : <Archive />} {account.archived ? "แสดงบัญชีอีกครั้ง" : "ซ่อนบัญชี"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ConfirmAction
            title={`ลบบัญชี "${account.name}"?`}
            description="ลบได้เฉพาะบัญชีที่ยังไม่มีรายการ หากมีรายการแล้วให้ใช้ “ซ่อนบัญชี” แทน"
            action={deleteAccountAction.bind(null, account.id)}
            trigger={
              <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                <Trash2 /> ลบบัญชี
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
