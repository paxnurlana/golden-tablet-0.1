import { expect, it } from "vitest";
import { sortWorkflowCards, type WorkflowCard } from "../src/lib/workflow";
it("sorts by stable creation time separately from editing time", () => {
  const cards = [
    { id:"new",text:"Б",created_at:"2026-10-10",updated_at:"2026-10-10" },
    { id:"old",text:"А",created_at:"2026-10-01",updated_at:"2026-10-11" },
  ] as WorkflowCard[];
  expect(sortWorkflowCards(cards,"oldest").map(c=>c.id)).toEqual(["old","new"]);
  expect(sortWorkflowCards(cards,"newest").map(c=>c.id)).toEqual(["new","old"]);
  expect(sortWorkflowCards(cards,"updated")[0]?.id).toBe("old");
  expect(sortWorkflowCards(cards,"name")[0]?.id).toBe("old");
});
