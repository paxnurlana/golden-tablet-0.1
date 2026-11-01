export const REVIEW_CONTEXT = {
  vpOpen: ["Inside Value Area", "Outside Value Area", "Near POC", "Near VAH", "Near VAL"],
  vwapOpen: [
    "At VWAP (0σ)",
    "0 to +1σ",
    "+1 to +2σ",
    "+2 to +3σ",
    "Above +3σ",
    "0 to −1σ",
    "−1 to −2σ",
    "−2 to −3σ",
    "Below −3σ",
  ],
  vpShape: ["D", "b", "P", "Thin", "B (double distribution)"],
  preSessionVpOpen: ["Inside Value Area", "Outside Value Area", "Near POC", "Near VAH", "Near VAL"],
  preSessionVpShape: ["D", "b", "P", "Thin", "B (double distribution)"],
} as const;
export const dayStatusLabel=(status?:string)=>status==='Nothing Day'?'Nothing':status==='BE'?'Breakeven':status||'—';
export function missedDominatesDay(results:string[][]){
 const counts={missed:0,win:0,loss:0,be:0};
 for(const names of results){const normalized=names.map(n=>n.trim().toLowerCase());
  if(normalized.some(n=>n==='missed'||n==='miss'))counts.missed++;
  else if(normalized.includes('win'))counts.win++;
  else if(normalized.includes('loss'))counts.loss++;
  else if(normalized.some(n=>n==='be'||n==='breakeven'))counts.be++;
 }
 return counts.missed>Math.max(counts.win,counts.loss,counts.be);
}
export const dayTone = (status?: string) =>
  status === "Missed" ? "border-orange-500/25 bg-orange-500/[0.07]" : status === "Win Day"
    ? "border-emerald-500/25 bg-emerald-500/[0.07]"
    : status === "Loss Day"
      ? "border-rose-500/25 bg-rose-500/[0.07]"
      : status === "BE"
        ? "border-blue-500/25 bg-blue-500/[0.07]"
        : "";
export const statusTone = (status?: string) =>
  status === "Missed" ? "text-orange-400 bg-orange-500/10 border-orange-500/20" : status === "Win Day"
    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
    : status === "Loss Day"
      ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
      : status === "BE"
        ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
        : "text-foreground bg-muted border-border";
