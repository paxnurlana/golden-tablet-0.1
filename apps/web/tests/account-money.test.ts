import { expect, it } from "vitest";
import { convertAccountMoney, displayAccountMoney } from "../src/lib/account-money";
const account = { accountId: "test", riskPct: null, pnlCash: null, pnlPct: null };
it("converts risk and signed PnL in both directions without conflating them", () => {
  expect(convertAccountMoney(account, "riskCash", 300, 50000)).toMatchObject({
    riskCash: 300,
    riskPct: 0.6,
  });
  expect(convertAccountMoney(account, "riskPct", 0.6, 50000)).toMatchObject({
    riskCash: 300,
    riskPct: 0.6,
  });
  expect(convertAccountMoney(account, "pnlCash", -300, 50000)).toMatchObject({
    pnlCash: -300,
    pnlPct: -0.6,
    riskPct: null,
  });
  expect(convertAccountMoney(account, "pnlPct", -0.6, 50000)).toMatchObject({
    pnlCash: -300,
    pnlPct: -0.6,
  });
  expect(displayAccountMoney({ ...account, pnlCash: -600 }, 50000).pnlPct).toBe(-1.2);
  expect(convertAccountMoney(account, "pnlCash", 0, 50000).pnlPct).toBe(0);
});
it("clears both linked fields and does not divide by missing balances", () => {
  expect(
    convertAccountMoney({ ...account, pnlCash: 300, pnlPct: 0.6 }, "pnlCash", null, 50000).pnlPct,
  ).toBeNull();
  expect(convertAccountMoney(account, "riskCash", 300, 0).riskPct).toBeNull();
});
