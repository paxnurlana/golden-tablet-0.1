export const JOURNAL_COVERS = [
  { key: "win", result: "Win" },
  { key: "loss", result: "Loss" },
  { key: "be", result: "Breakeven" },
  { key: "missed", result: "Missed" },
  { key: "nlo", result: "НЛО" },
  { key: "hypothesis", result: "Hypothesis" },
];
export const coverForResult = (name: string) =>
  `/covers/v1/${JOURNAL_COVERS.find((item) => item.result === (name === "BE" ? "Breakeven" : name))?.key ?? "nlo"}.png`;
