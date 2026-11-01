import type { AccountResult } from "@/server/personal-journal";
export type MoneyField = "riskCash" | "riskPct" | "pnlCash" | "pnlPct";
const round = (n: number, places: number) =>
  Math.round((n + Number.EPSILON) * 10 ** places) / 10 ** places;
export function convertAccountMoney(
  account: AccountResult,
  field: MoneyField,
  value: number | null,
  base: number | null,
): AccountResult {
  const result = { ...account, [field]: value };
  const other: MoneyField =
    field === "riskCash"
      ? "riskPct"
      : field === "riskPct"
        ? "riskCash"
        : field === "pnlCash"
          ? "pnlPct"
          : "pnlCash";
  if (value === null) return { ...result, [other]: null };
  if (!base || base <= 0) return result;
  return {
    ...result,
    baseBalance: base,
    [other]: field.endsWith("Pct")
      ? round((value / 100) * base, 2)
      : round((value / base) * 100, 6),
  };
}
export function displayAccountMoney(account: AccountResult, base: number | null) {
  let result = { ...account };
  if (base && base > 0) {
    if (result.riskCash != null)
      result = convertAccountMoney(result, "riskCash", result.riskCash, base);
    else if (result.riskPct != null)
      result = convertAccountMoney(result, "riskPct", result.riskPct, base);
    if (result.pnlCash != null)
      result = convertAccountMoney(result, "pnlCash", result.pnlCash, base);
    else if (result.pnlPct != null)
      result = convertAccountMoney(result, "pnlPct", result.pnlPct, base);
  }
  return result;
}
