"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatCompact, formatMoney } from "@/lib/format";

export type ChartPoint = {
  label: string; // ป้ายแกน X (สั้น)
  title: string; // หัว tooltip (เต็ม)
  income: number;
  expense: number;
  net: number;
  balance: number | null; // null = งวดในอนาคต
};

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

function Frame({ height = 260, children }: { height?: number; children: React.ReactElement }) {
  return (
    <div style={{ height }} className="w-full [&_.recharts-surface]:overflow-visible">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

type Row = { name: string; value: number; color: string };

function TooltipBox({ title, rows, footer }: { title: string; rows: Row[]; footer?: Row }) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-[2px]" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="tabular">{formatMoney(r.value)}</span>
        </div>
      ))}
      {footer && (
        <div className="mt-1 flex justify-between gap-4 border-t pt-1 font-medium">
          <span>{footer.name}</span>
          <span className="tabular">{formatMoney(footer.value)}</span>
        </div>
      )}
    </div>
  );
}

function pointOf(props: Pick<TooltipContentProps<number, string>, "active" | "payload">) {
  if (!props.active || !props.payload?.length) return null;
  return props.payload[0].payload as ChartPoint;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** รายรับ vs รายจ่าย (แท่งคู่) */
export function IncomeExpenseChart({
  data,
  show = "both",
  height,
}: {
  data: ChartPoint[];
  show?: "both" | "income" | "expense";
  height?: number;
}) {
  const showIncome = show !== "expense";
  const showExpense = show !== "income";
  return (
    <>
      <Legend
        items={[
          ...(showIncome ? [{ label: "รายรับ", color: "var(--income)" }] : []),
          ...(showExpense ? [{ label: "รายจ่าย", color: "var(--expense)" }] : []),
        ]}
      />
      <Frame height={height}>
        <BarChart data={data} barGap={1} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => {
              const d = pointOf(p);
              if (!d) return null;
              return (
                <TooltipBox
                  title={d.title}
                  rows={[
                    ...(showIncome ? [{ name: "รายรับ", value: d.income, color: "var(--income)" }] : []),
                    ...(showExpense ? [{ name: "รายจ่าย", value: d.expense, color: "var(--expense)" }] : []),
                  ]}
                  footer={show === "both" ? { name: "คงเหลือ", value: d.net, color: "" } : undefined}
                />
              );
            }}
          />
          {showIncome && <Bar dataKey="income" name="รายรับ" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
          {showExpense && <Bar dataKey="expense" name="รายจ่าย" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
        </BarChart>
      </Frame>
    </>
  );
}

/** Cash Flow: เงินเข้าสุทธิต่องวด บวก = ฟ้า, ลบ = แดง */
export function CashFlowChart({ data, height }: { data: ChartPoint[]; height?: number }) {
  return (
    <>
      <Legend
        items={[
          { label: "เงินเข้าสุทธิ (บวก)", color: "var(--income)" },
          { label: "เงินออกสุทธิ (ลบ)", color: "var(--negative)" },
        ]}
      />
      <Frame height={height}>
        <BarChart data={data} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => {
              const d = pointOf(p);
              if (!d) return null;
              return (
                <TooltipBox
                  title={d.title}
                  rows={[
                    { name: "รายรับ", value: d.income, color: "var(--income)" },
                    { name: "รายจ่าย", value: d.expense, color: "var(--expense)" },
                  ]}
                  footer={{ name: "สุทธิ", value: d.net, color: "" }}
                />
              );
            }}
          />
          <Bar dataKey="net" radius={4} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.title} fill={d.net >= 0 ? "var(--income)" : "var(--negative)"} />
            ))}
          </Bar>
        </BarChart>
      </Frame>
    </>
  );
}

/** แนวโน้มเงินคงเหลือรวมทุกบัญชี */
export function BalanceTrendChart({ data, height }: { data: ChartPoint[]; height?: number }) {
  return (
    <Frame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--income)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--income)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={6} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} domain={["auto", "auto"]} />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          content={(p) => {
            const d = pointOf(p);
            if (!d || d.balance == null) return null;
            return <TooltipBox title={d.title} rows={[{ name: "ยอดเงินรวม", value: d.balance, color: "var(--income)" }]} />;
          }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--income)"
          strokeWidth={2}
          fill="url(#balanceFill)"
          activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
          dot={false}
        />
      </AreaChart>
    </Frame>
  );
}
