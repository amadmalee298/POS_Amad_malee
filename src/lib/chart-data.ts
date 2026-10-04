import type { SeriesPoint } from "@/lib/queries";
import { TH_MONTHS, TH_MONTHS_SHORT, parseMonth, toBE } from "@/lib/format";
import type { ChartPoint } from "@/components/charts/finance-charts";

// งวดในอนาคตยังไม่มียอดคงเหลือจริง → null เพื่อให้เส้นแนวโน้มหยุดที่วันนี้
const cut = (p: SeriesPoint, today: string) => (p.key > today.slice(0, p.key.length) ? null : p.balance);

export function dailyChartPoints(series: SeriesPoint[], today: string): ChartPoint[] {
  return series.map((p) => {
    const { year, month } = parseMonth(p.key.slice(0, 7));
    return { ...p, balance: cut(p, today), title: `${Number(p.key.slice(8))} ${TH_MONTHS[month - 1]} ${toBE(year)}` };
  });
}

export function monthlyChartPoints(series: SeriesPoint[], today: string): ChartPoint[] {
  return series.map((p) => {
    const { year, month } = parseMonth(p.key);
    return { ...p, balance: cut(p, today), label: TH_MONTHS_SHORT[month - 1], title: `${TH_MONTHS[month - 1]} ${toBE(year)}` };
  });
}
