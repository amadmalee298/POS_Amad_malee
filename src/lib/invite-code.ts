// รหัสเชิญ 8 ตัว ไม่มีตัวที่สับสนง่าย (0/O, 1/I/L) แสดงเป็น XXXX-XXXX

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** ผู้ใช้อาจพิมพ์ตัวเล็ก มีขีด หรือเว้นวรรค → เก็บ/ค้นเป็นตัวใหญ่ล้วน */
export function normalizeInviteCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatInviteCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function generateInviteCode(randomBytes: (n: number) => Uint8Array) {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
