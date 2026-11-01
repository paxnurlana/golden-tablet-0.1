export function PotentialRRHint({value,coverage}:{value:number|null|undefined;coverage?:string}){
  if(value==null||value<=0)return null;
  return <span className="ml-1 whitespace-nowrap align-baseline text-[length:inherit] font-semibold leading-[inherit] tabular-nums text-foreground" title={`Упущенный потенциал: ${Number(value.toFixed(2))}R. Оценка, не фактическая прибыль${coverage?` · ${coverage}`:''}`} aria-label={`Упущенный потенциал ${Number(value.toFixed(2))}R`}>({Number(value.toFixed(2)).toLocaleString('ru-RU')}RR?)</span>;
}
