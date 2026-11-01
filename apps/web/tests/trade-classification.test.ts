import { expect,it } from "vitest";
import { classificationStats, DETAILS, ACTIVE_DETAILS,resultIconColor, resultName } from "../src/lib/trade-classification";
it('offers a reduced stop only for Loss and retains the normal loss color',()=>{
 expect(ACTIVE_DETAILS.find(d=>d.id==='loss-small')).toMatchObject({result:'Loss',label:'Небольшой лосс / сокращённый стоп'});
 expect(resultIconColor('Loss','loss-small')).toBe('#fb7185');
 expect(resultIconColor('Win','loss-small')).toBe('#34d399');
});
it('locks the detail color matrix and keeps retired managed wins only in historical data',()=>{
 const cases:[string,string,string][]=[['BE','be-minus','#fb7185'],['BE','be-saved','#a78bfa'],['BE','be-target','#facc15'],['BE','be-move','#60a5fa'],['Loss','loss-stop','#fb7185'],['Loss','loss-target','#facc15'],['Loss','loss-entry','#fb7185'],['Win','win-target','#34d399'],['Win','win-small','#fb7185'],['Win','win-manual','#facc15'],['Missed','missed-fear','#fb923c']];
 for(const [result,detail,color] of cases)expect(resultIconColor(result,detail,2)).toBe(color);
 expect(resultIconColor('Hypothesis',undefined,2)).toBe('#f4f6f8');for(const id of ['win-managed','loss-entry']){expect(ACTIVE_DETAILS.some(d=>d.id===id)).toBe(false);expect(DETAILS.some(d=>d.id===id)).toBe(true);}
});
it("offers the three requested Missed reasons", () => {
  expect(DETAILS.filter(d => d.result === "Missed").map(d => d.label)).toEqual([
    "Зассал открываться", "Противоречивые аргументы с 2х сторон", "Проморгал",
  ]);
});
it("names unidentified trades and keeps four distinct Breakeven details", () => {
  expect(resultName("НЛО")).toBe("Неопознанный трейд");
  expect(DETAILS.filter(d => d.result === "Breakeven").map(d => d.color)).toEqual(["#a78bfa", "#fb7185", "#facc15", "#60a5fa"]);
});
it("keeps small wins manually classified, independent of realised R", () => {
  expect(DETAILS.find(d => d.id === "win-small")?.label).toBe("Small win — до 1RR");
  const rows = classificationStats([{realisedR:0.5,mae:null,mfe:null,classification:{},terms:{result:["win"]}}],new Map([["win","Win"]]));
  expect(rows[0]?.label).toBe("Не уточнено / не проверено");
});
it("counts actual outcomes, excludes missed entries, separates instruments and skips unknown excursion values",()=>{
  const names=new Map([["be","Breakeven"],["win","Win"],["missed","Missed"],["gc","GC"],["mgc","MGC"]]);
  const base={realisedR:0,mae:null,mfe:null,classification:{detail:"be-target"},terms:{result:["be"],instrument:["gc"]}};
  const rows=classificationStats([base,{...base,mae:10,mfe:20},{...base,terms:{result:["be"],instrument:["mgc"]}},{...base,terms:{result:["missed"],instrument:["gc"]}}],names);
  expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({count:2,wins:0,avgR:0,mae:10,mfe:20});
});
