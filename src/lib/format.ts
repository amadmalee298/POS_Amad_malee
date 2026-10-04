// ตัวช่วยจัดรูปแบบเงิน/วันที่ — วันที่ทั้งหมดเก็บเป็น UTC midnight (คอลัมน์ @db.Date)
// และแสดงผลด้วยปฏิทินพุทธศักราช

export const TZ = "Asia/Bangkok";

const moneyFmt = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const moneyFmt0 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

export function formatMoney(n: number, opts: { sign?: boolean; decimals?: boolean } = {}) {
  const { sign = false, decimals = true } = opts;
  const body = "฿" + (decimals ? moneyFmt : moneyFmt0).format(Math.abs(n));
  if (n < 0) return "−" + body;
  if (sign && n > 0) return "+" + body;
  return body;
}

export function formatCompact(n: number) {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1_000_000) return `${s}${moneyFmt0.format(a / 1_000_000)}M`;
  if (a >= 1_000) return `${s}${moneyFmt0.format(a / 1_000)}k`;
  return `${s}${moneyFmt0.format(a)}`;
}

export function formatPercent(n: number) {
  return `${moneyFmt0.format(n)}%`;
}

export const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** ปี ค.ศ. → พ.ศ. */
export const toBE = (year: number) => year + 543;

/** "2026-10" → "ตุลาคม 2569" */
export function monthLabel(ym: string, short = false) {
  const { year, month } = parseMonth(ym);
  return short
    ? `${TH_MONTHS_SHORT[month - 1]} ${String(toBE(year)).slice(2)}`
    : `${TH_MONTHS[month - 1]} ${toBE(year)}`;
}

/** Date (UTC midnight) → "3 ต.ค. 69" */
export function formatDate(d: Date, withYear = true) {
  const day = d.getUTCDate();
  const m = TH_MONTHS_SHORT[d.getUTCMonth()];
  return withYear ? `${day} ${m} ${String(toBE(d.getUTCFullYear())).slice(2)}` : `${day} ${m}`;
}

/** วันนี้ตามเวลาประเทศไทย ในรูป "YYYY-MM-DD" */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date ที่ UTC midnight */
export function parseISODate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

export function isValidMonth(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function parseMonth(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  return { year, month };
}

export function shiftMonth(ym: string, delta: number) {
  const { year, month } = parseMonth(ym);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** ช่วง [start, end) ของเดือน */
export function monthRange(ym: string) {
  const { year, month } = parseMonth(ym);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function yearRange(year: number) {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

export function daysInMonth(ym: string) {
  const { year, month } = parseMonth(ym);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
