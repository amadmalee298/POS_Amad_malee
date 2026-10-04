"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type Option = { id: string; name: string; icon: string };

export function TransactionFilters({ accounts, categories }: { accounts: Option[]; categories: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    startTransition(() => router.replace(`${pathname}?${p}`, { scroll: false }));
  };

  // ค้นหาแบบหน่วงเวลาเล็กน้อยระหว่างพิมพ์
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update("q", q.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
      <NativeSelect aria-label="กรองตามบัญชี" value={params.get("account") ?? ""} onChange={(e) => update("account", e.target.value)}>
        <option value="">ทุกบัญชี</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.icon} {a.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="กรองตามหมวดหมู่" value={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
        <option value="">ทุกหมวดหมู่</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </NativeSelect>
      <div className="relative col-span-2 sm:col-span-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" placeholder="ค้นหารายละเอียด/หมายเหตุ…" aria-label="ค้นหา" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
    </div>
  );
}
