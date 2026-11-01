export const DETAILS = [
  { id: "missed-fear", result: "Missed", label: "Зассал открываться", color: "#fb923c" },
  { id: "missed-conflict", result: "Missed", label: "Противоречивые аргументы с 2х сторон", color: "#fb923c" },
  { id: "missed-overlooked", result: "Missed", label: "Проморгал", color: "#fb923c" },
  { id: "be-saved", result: "Breakeven", label: "Спас от стопа", color: "#a78bfa" },
  { id: "be-minus", result: "Breakeven", label: "Небольшой минус", color: "#fb7185" },
  { id: "be-target", result: "Breakeven", label: "После БУ дошла до TP", color: "#facc15" },
  { id: "be-move", result: "Breakeven", label: "Дала движение без TP", color: "#60a5fa" },
  { id: "loss-stop", result: "Loss", label: "Обычный стоп", color: "#fb7185" },
  { id: "loss-small", result: "Loss", label: "Небольшой лосс / сокращённый стоп", color: "#fb7185" },
  { id: "loss-target", result: "Loss", label: "После стопа дошла до TP", color: "#facc15" },
  { id: "loss-entry", result: "Loss", label: "После стопа вернулась к входу (архив)", color: "#fb7185" },
  { id: "win-target", result: "Win", label: "Победа по TP", color: "#34d399" },
  { id: "win-small", result: "Win", label: "Small win — до 1RR", color: "#fb7185" },
  { id: "win-manual", result: "Win", label: "Неполный win — закрытие до TP", color: "#facc15" },
  {
    id: "win-managed",
    result: "Win",
    label: "Частичное закрытие / сопровождение (архив)",
    color: "#34d399",
  },
];
/** Retain retired IDs for historical records and validation, not for new classifications. */
export const ACTIVE_DETAILS=DETAILS.filter(detail=>!['win-managed','loss-entry'].includes(detail.id));
export function resultIconColor(name:string,detail?:string,missed?:number|null){
 const result=name==='BE'?'Breakeven':name;
 const selected=DETAILS.find(item=>item.id===detail&&item.result===result);
 if(selected)return selected.color;
 if(result==='Missed')return '#fb923c';
 if(result==='Loss')return '#fb7185';
 if(result==='Win')return (missed??0)>0?'#facc15':'#34d399';
 if(result==='Breakeven')return (missed??0)>0?'#facc15':'#60a5fa';
 return '#f4f6f8';
}
export const EXECUTION_TAGS = [
  "Гипотеза",
  "FOMO",
  "Revenge",
  "Импульсивный вход",
  "Нарушение правил",
  "Ранний выход",
];
export type TradeClassification = { detail?: string; tags?: string[];targetHit?:boolean|null };
export const CHARACTER_TONES:Record<string,{color:string;chip:string}>={
  Clear:{color:'#34d399',chip:'bg-emerald-500/15'},
  Anomaly:{color:'#facc15',chip:'bg-yellow-500/15'},
  Dirty:{color:'#fb7185',chip:'bg-rose-500/15'},
  'Re-entry':{color:'#38bdf8',chip:'bg-sky-500/15'},
  'Гипотеза':{color:'#a78bfa',chip:'bg-violet-500/15'},
  FOMO:{color:'#fb923c',chip:'bg-orange-500/15'},
  Revenge:{color:'#f87171',chip:'bg-red-500/15'},
  'Импульсивный вход':{color:'#fbbf24',chip:'bg-amber-500/15'},
  'Нарушение правил':{color:'#fb7185',chip:'bg-rose-500/15'},
  'Ранний выход':{color:'#2dd4bf',chip:'bg-teal-500/15'},
};
export const resultName = (name: string) => name === "BE" ? "Breakeven" : name === "НЛО" ? "Неопознанный трейд" : name;
import {isScenarioEntry} from './trade-accounting';
export function classificationStats(
  entries: {
    classification?: TradeClassification;
    realisedR: number | null;
    mfe: number | null;
    mae: number | null;
    terms: { result?: string[]; instrument?: string[] };
  }[],
  names: Map<string, string>,
) {
  const executed = entries.filter((e) =>
    !isScenarioEntry(e,names) && e.terms.result?.some((id) =>
      ["Win", "Loss", "Breakeven"].includes(resultName(names.get(id) ?? "")),
    ),
  );
  const mean = (values: (number | null)[]) => {
    const known = values.filter((n): n is number => n !== null);
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
  };
  const group = (e: (typeof executed)[number]) =>
    `${e.classification?.detail || ""}|${e.terms.instrument?.[0] || ""}`;
  return [...new Set(executed.map(group))].map((key) => {
    const rows = executed.filter((e) => group(e) === key);
    const detail = rows[0]!.classification?.detail;
    return {
      key,
      asset: names.get(rows[0]!.terms.instrument?.[0] ?? "") ?? "Без Asset",
      label: DETAILS.find((d) => d.id === detail)?.label ?? "Не уточнено / не проверено",
      count: rows.length,
      avgR: mean(rows.map((e) => e.realisedR)),
      mae: mean(rows.map((e) => e.mae)),
      mfe: mean(rows.map((e) => e.mfe)),
      wins: rows.filter((e) => e.terms.result?.some((id) => names.get(id) === "Win")).length,
    };
  });
}
