import { expect,it } from "vitest";
import { leadingDecimalZero,parseDecimalInput } from "../src/lib/decimal-input";
it("accepts decimal commas and dots without losing the leading zero",()=>{
  for(const raw of ["0,43","0.43",",43",".43"])expect(parseDecimalInput(raw)).toBe(.43);
  expect(leadingDecimalZero(",")).toBe("0,");expect(leadingDecimalZero(".")).toBe("0.");
  expect(parseDecimalInput("0,")).toBe(0);expect(parseDecimalInput("")).toBeNull();
  expect(parseDecimalInput("0,4,3")).toBeNaN();
});
