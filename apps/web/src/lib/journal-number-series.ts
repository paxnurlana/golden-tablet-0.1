export type NumberSeries='main'|'hypothesis'|'unidentified';
export function numberSeries(names:string[]):NumberSeries{
 const values=names.map(n=>n.trim().toLowerCase());
 if(values.some(n=>['нло','неопознанный трейд'].includes(n)))return 'unidentified';
 if(values.some(n=>['hypothesis','hypotesys','hypothesys'].includes(n)))return 'hypothesis';
 return 'main';
}
