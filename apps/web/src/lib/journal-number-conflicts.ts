/** Numbers are labels, never identities. Count across all active entries, not filtered rows. */
export function journalNumberConflictIds(entries:{id:string;tradeNo:number;numberSeries?:string}[]){
 const groups=new Map<string,string[]>();
 for(const e of new Map(entries.map(e=>[e.id,e])).values()){
  const key=`${e.numberSeries??'main'}:${e.tradeNo}`;groups.set(key,[...(groups.get(key)??[]),e.id]);
 }
 return new Set([...groups.values()].filter(ids=>ids.length>1).flat());
}
export function journalNumberConflicts(entries: {id:string;tradeNo:number}[]) {
  const counts=new Map<number,number>();
  for(const entry of new Map(entries.map(e=>[e.id,e])).values()) counts.set(entry.tradeNo,(counts.get(entry.tradeNo)??0)+1);
  return new Set([...counts].filter(([,count])=>count>1).map(([number])=>number));
}
