"use client";
import { useEffect, useRef, useState } from "react";
import type { AccountResult } from "@/server/personal-journal";
import { convertAccountMoney, displayAccountMoney, type MoneyField } from "@/lib/account-money";
const keys = [
  ["riskCash", "Risk · $"],
  ["riskPct", "Risk · %"],
  ["pnlCash", "PNL Cash · $"],
  ["pnlPct", "P&L · %"],
] as const;
export function AccountMoneyFields({
  account,
  base:rawBase,
  onCommit,
}: {
  account: AccountResult;
  base: number | null;
  onCommit: (values: AccountResult & { editedField: MoneyField }) => void;
}) {
  const base=rawBase!==null&&rawBase>0?rawBase:null;
  const displayed = displayAccountMoney(account, base);
  const strings = (values: AccountResult) =>
    Object.fromEntries(
      keys.map(([k]) => [k, values[k] == null ? "" : String(values[k])]),
    ) as Record<MoneyField, string>;
  const [draft, setDraft] = useState(() => strings(displayed));
  const dirty = useRef(new Set<MoneyField>()),
    host = useRef<HTMLDivElement>(null);
  const serialized = JSON.stringify(displayed);
  useEffect(() => {
    setDraft(old=>{
      let merged=displayed;
      for(const key of dirty.current)merged=convertAccountMoney(merged,key,old[key]===''?null:Number(old[key]),base);
      const next=strings(merged);for(const key of dirty.current)next[key]=old[key];return next;
    });
  }, [serialized,base]);
  return (
    <div ref={host} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {keys.map(([key, label]) => (
          <label key={key} className="text-xs text-muted-foreground">
            {label}
            <input
              aria-label={label}
              type="number"
              step="any"
              min={key.startsWith("risk") ? 0 : undefined}
              value={draft[key]}
              onChange={(event) => {
                const raw = event.target.value;
                dirty.current.add(key);
                const value = raw === "" ? null : Number(raw);
                const changed = convertAccountMoney(displayed, key, value, base);
                const other =
                  key === "riskCash"
                    ? "riskPct"
                    : key === "riskPct"
                      ? "riskCash"
                      : key === "pnlCash"
                        ? "pnlPct"
                        : "pnlCash";
                setDraft((old) => ({
                  ...old,
                  [key]: raw,
                  [other]: changed[other] == null ? "" : String(changed[other]),
                }));
              }}
              onBlur={(event) => {
                if (!dirty.current.has(key) || event.target.validity.badInput) return;
                dirty.current.delete(key);
                const value = event.target.value === "" ? null : Number(event.target.value);
                onCommit({ ...convertAccountMoney(account, key, value, base), editedField: key });
              }}
              className={`mt-1 min-h-9 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:border-sky-500 ${key.startsWith("pnl") && Number(draft[key]) < 0 ? "text-rose-500" : key.startsWith("pnl") && Number(draft[key]) > 0 ? "text-emerald-500" : ""}`}
            />
          </label>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {base
          ? `База расчёта: ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(base)} $`
          : "Для пересчёта процентов настрой баланс аккаунта."}
      </p>
    </div>
  );
}
