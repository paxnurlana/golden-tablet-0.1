import { expect, it } from "vitest";
import { volumeUnit, sumVolumes } from "../src/lib/trade-volume";
it("uses lots for spot gold and contracts for gold futures",()=>{
  expect(volumeUnit('GC','CFD')).toBe('lots');
  expect(volumeUnit('GC','Forex')).toBe('lots');
  expect(volumeUnit('XAUUSD','Futures')).toBe('contracts');
  expect(volumeUnit("XAUUSD.P")).toBe("lots");
  for(const asset of ["GC","MGC","COMEX:GC1!","MGCZ26"]) expect(volumeUnit(asset)).toBe("contracts");
  expect(volumeUnit("Other")).toBe("units");
});
it("never combines lots, GC and MGC contracts",()=>{
  expect(sumVolumes([{asset:"GC",unit:"contracts",quantity:1},{asset:"MGC",unit:"contracts",quantity:10},{asset:"XAUUSD",unit:"lots",quantity:0.1},{asset:"XAUUSD",unit:"lots",quantity:0.2}])).toEqual([{asset:"GC",unit:"contracts",quantity:1},{asset:"MGC",unit:"contracts",quantity:10},{asset:"XAUUSD",unit:"lots",quantity:0.3}]);
});
