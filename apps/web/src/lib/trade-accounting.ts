// Scenarios keep their measurements but never contribute to executed-trade totals.
export const SCENARIO_NAMES=new Set(['missed','miss','hypothesis','hypotesys','hypothesys','нло','неопознанный трейд']);
export function isScenarioName(name:string){return SCENARIO_NAMES.has(name.trim().toLowerCase());}
export function isScenarioEntry(entry:{terms:{result?:string[]}}, names:Map<string,string>){return (entry.terms.result??[]).some(id=>isScenarioName(names.get(id)??''));}
