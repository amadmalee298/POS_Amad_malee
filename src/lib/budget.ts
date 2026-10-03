/** สีแถบงบประมาณตามสัดส่วนที่ใช้ไป (ratio = ใช้ไป / งบ) */
export function budgetTone(ratio: number) {
  if (ratio > 1) return "bg-negative";
  if (ratio >= 0.8) return "bg-warning";
  return "bg-primary";
}

export function budgetStatus(ratio: number) {
  if (ratio > 1) return { label: "เกินงบ", className: "text-negative" };
  if (ratio >= 0.8) return { label: "ใกล้เต็มงบ", className: "text-warning" };
  return { label: "ปกติ", className: "text-positive" };
}
