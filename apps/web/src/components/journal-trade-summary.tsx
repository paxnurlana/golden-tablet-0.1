import { JournalResultBadge, JournalResultIcon } from "./journal-icons";
import {PotentialRRHint} from './potential-rr-hint';
export function JournalTradeSummary({
  tradeNo,
  results,
  rr,
  detail,
  onNumberChange,
  scenario=false,
  duplicateNumber=false,
  missed,
}: {
  tradeNo: number;
  results: string[];
  rr: number | null;
  detail?: string;
  onNumberChange?: (number:number|null)=>void;
  scenario?:boolean;
  duplicateNumber?:boolean;
  missed?:number|null;
}) {
  const number =
    rr === null
      ? "—"
      : `${rr > 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(rr)}R`;
  return (
    <div className="mb-5 inline-flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-card/50 px-3 py-2">
      <JournalResultIcon name={results[0] ?? "НЛО"} detail={detail} missed={missed} className="size-8" />
      <h2 className="text-xl font-semibold leading-7 tabular-nums">
        <span className="mr-0.5 text-muted-foreground">#</span>
        {onNumberChange ? <input key={tradeNo} aria-label="Номер сделки" title="Можно задать свой номер; очистить — вернуть автоматический" type="number" min="1" step="1" defaultValue={tradeNo} className="w-20 rounded border border-transparent bg-transparent px-1 font-semibold outline-none hover:border-border focus:border-sky-400" onBlur={event=>{const text=event.currentTarget.value;const number=text===''?null:Number(text);if(number!==null&&(!Number.isSafeInteger(number)||number<1)){event.currentTarget.reportValidity();return;}if(number!==tradeNo)onNumberChange(number);}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/> : tradeNo}
      </h2>
      {duplicateNumber&&<span className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-400" role="status">Номер повторяется · обе сделки сохранены</span>}
      {results.map((name) => (
        <JournalResultBadge key={name} name={name} />
      ))}
      <span className="inline-flex h-7 items-center gap-1.5 border-l border-white/[0.08] pl-3 text-sm">
        {!scenario&&<span className="text-muted-foreground">RR</span>}
        {!scenario&&
        <strong
          className={`font-semibold tabular-nums ${scenario || rr === null ? "text-muted-foreground" : rr > 0 ? "text-emerald-400" : rr < 0 ? "text-rose-400" : "text-blue-400"}`}
        >
          {number}
        </strong>}
        <PotentialRRHint value={missed}/>
      </span>
    </div>
  );
}
