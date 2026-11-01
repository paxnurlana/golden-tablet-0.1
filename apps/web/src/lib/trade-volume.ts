export type VolumeUnit = "lots" | "contracts" | "units";
export function volumeUnit(asset: string, market?: string): VolumeUnit {
  if (market === 'Futures') return 'contracts';
  if (market === 'CFD' || market === 'Forex') return 'lots';
  const symbol = asset.toUpperCase().trim().split(":").at(-1)!;
  if (/^(MGC|GC)(?:\d!|[FGHJKMNQUVXZ]\d{1,4}|[.!].*)?$/.test(symbol)) return "contracts";
  if (symbol.startsWith("XAUUSD")) return "lots";
  return market === "Futures" ? "contracts" : ["Forex", "CFD"].includes(market ?? "") ? "lots" : "units";
}
export const volumeLabels: Record<VolumeUnit, string> = { lots: "лоты", contracts: "контракты", units: "ед." };
export type VolumeTotal = { asset: string; unit: VolumeUnit; quantity: number };
export function sumVolumes(rows: VolumeTotal[]): VolumeTotal[] {
  const totals = new Map<string, VolumeTotal>();
  for (const row of rows) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) continue;
    const key = `${row.asset}:${row.unit}`;
    const old = totals.get(key);
    totals.set(key, { ...row, quantity: Math.round(((old?.quantity ?? 0) + row.quantity) * 1e8) / 1e8 });
  }
  return [...totals.values()].sort((a, b) => a.asset.localeCompare(b.asset));
}
