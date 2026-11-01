export function parseDecimalInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}
export function leadingDecimalZero(raw: string) { return /^[.,]/.test(raw) ? `0${raw}` : raw; }
