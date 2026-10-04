import type { AccountType } from "@/generated/prisma/enums";

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: "CASH", label: "เงินสด", icon: "💵" },
  { value: "BANK", label: "บัญชีธนาคาร", icon: "🏦" },
  { value: "CREDIT_CARD", label: "บัตรเครดิต", icon: "💳" },
  { value: "EWALLET", label: "e-Wallet", icon: "📱" },
  { value: "SAVINGS", label: "เงินฝาก/ออมทรัพย์", icon: "🐷" },
  { value: "INVESTMENT", label: "การลงทุน", icon: "📈" },
  { value: "OTHER", label: "อื่น ๆ", icon: "👛" },
];

export const accountTypeLabel = (t: AccountType) =>
  ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export const DEFAULT_ACCOUNTS: { name: string; type: AccountType; icon: string }[] = [
  { name: "เงินสด", type: "CASH", icon: "💵" },
  { name: "KBank", type: "BANK", icon: "🏦" },
  { name: "SCB", type: "BANK", icon: "🏦" },
  { name: "บัตรเครดิต", type: "CREDIT_CARD", icon: "💳" },
  { name: "TrueMoney", type: "EWALLET", icon: "📱" },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: "เงินเดือน", icon: "💼" },
  { name: "รายได้ร้านครัวกะเพรา", icon: "🍳" },
  { name: "Freelance", icon: "💻" },
  { name: "โบนัส", icon: "🎁" },
  { name: "รายได้อื่น ๆ", icon: "💰" },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "อาหาร", icon: "🍜" },
  { name: "เดินทาง", icon: "🚗" },
  { name: "บ้าน", icon: "🏠" },
  { name: "ช้อปปิ้ง", icon: "🛍️" },
  { name: "ค่าน้ำ/ไฟ", icon: "💡" },
  { name: "โทรศัพท์", icon: "📱" },
  { name: "หนี้สิน", icon: "🧾" },
  { name: "ธุรกิจ", icon: "🏪" },
  { name: "อื่น ๆ", icon: "📦" },
];

export const EMOJI_CHOICES = [
  "💵", "🏦", "💳", "📱", "🐷", "📈", "👛", "💼", "🍳", "💻", "🎁", "💰",
  "🍜", "☕", "🚗", "⛽", "🏠", "🛍️", "💡", "🧾", "🏪", "🏥", "📚", "🎬",
  "✈️", "👶", "🐶", "🎮", "👕", "💇", "🎯", "🚘", "🛡️", "🎓", "🏖️", "📦",
];
