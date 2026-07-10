// Thai 13-digit national ID checksum (per Dept. of Provincial Administration spec).
// Digits 1-12 are weighted 12..1, checksum = (11 - sum%11) % 10 must equal digit 13.
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const digits = id.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (12 - i), 0);
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === digits[12];
}
