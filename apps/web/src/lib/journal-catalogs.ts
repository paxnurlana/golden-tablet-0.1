import type { JournalEntry, TermKind } from "@/server/personal-journal";
export const JOURNAL_CATALOGS: { kind: TermKind; label: string }[] = [
  { kind: "type", label: "Type" },
  { kind: "setup", label: "Setup" },
  { kind: "storyline", label: "Storyline" },
  { kind: "instrument", label: "Asset" },
  { kind: "trigger", label: "Trigger" },
  { kind: "vp", label: "VP Context" },
  { kind: "vwap", label: "VWAP Context" },
  { kind: "account", label: "Аккаунты" },
  { kind: "result", label: "Результат" },
];
export function relatedJournalEntries(entries: JournalEntry[], kind: TermKind, id: string) {
  return entries.filter((entry) =>
    kind === "account"
      ? entry.accounts.some((account) => account.accountId === id)
      : (entry.terms[kind] ?? []).includes(id),
  );
}
export function catalogStats(entries: JournalEntry[]) {
  const measured = entries.filter((entry) => entry.realisedR !== null);
  const netR = measured.reduce((sum, entry) => sum + entry.realisedR!, 0);
  return {
    count: entries.length,
    live: entries.filter((entry) => entry.mode === "Forward").length,
    historical: entries.filter((entry) => entry.mode === "Back").length,
    measured: measured.length,
    netR: measured.length ? netR : null,
    avgR: measured.length ? netR / measured.length : null,
  };
}
