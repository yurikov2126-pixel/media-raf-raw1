export function validLanIpv4(value) {
  if (typeof value !== 'string' || value.length > 15) return false;
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) ||
    Number(part) > 255 || String(Number(part)) !== part)) return false;
  const [first, second] = parts.map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}
