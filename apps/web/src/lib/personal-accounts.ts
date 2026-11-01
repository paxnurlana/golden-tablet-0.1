export type AccountProfile = {
  kind: "personal" | "prop";
  market: "Futures" | "Forex" | "CFD";
  leverage?: number | null;
  firmId: string;
  accountSize: number;
  openingBalance: number;
  startDate: string;
  stage: "Phase 1" | "Phase 2" | "Funded";
  drawdownType: "Static" | "EOD Trailing";
  drawdown: number;
  dailyLimit: number | null;
  phase1Target: number;
  phase2Target: number;
  traderShare: number;
  purchasePrice?: number;
};
export type AccountMovement = {
  id: string;
  accountId: string;
  kind: "deposit" | "withdrawal" | "payout" | "expense";
  date: string;
  amount: number;
  received: number;
  note: string;
};
export type AccountPhase = { stage: string; date: string };
export type JournalFirm = { id: string; name: string; logo: string; archived?: boolean };
export const defaultProfile = (): AccountProfile => ({
  kind: "personal",
  market: "Futures",
  firmId: "",
  accountSize: 0,
  openingBalance: 0,
  startDate: new Date().toISOString().slice(0, 10),
  stage: "Phase 1",
  drawdownType: "Static",
  drawdown: 0,
  dailyLimit: null,
  phase1Target: 0,
  phase2Target: 0,
  traderShare: 80,
  purchasePrice: 0,
});
export function accountBalance(opening: number, pnl: number, movements: AccountMovement[]) {
  return (
    opening +
    pnl +
    movements.reduce(
      (sum, m) => sum + (m.kind === "expense" ? 0 : m.kind === "deposit" ? m.amount : -m.amount),
      0,
    )
  );
}
export function payoutRoi(cost: number, received: number) {
  return cost > 0 ? ((received - cost) / cost) * 100 : null;
}
