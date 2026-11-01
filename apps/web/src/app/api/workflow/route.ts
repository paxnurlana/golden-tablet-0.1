import { handler, ok, requireValue } from "@/server/api";
import {
  listWorkflow,
  moveWorkflow,
  syncWorkflow,
  createWorkflow,
  updateWorkflowCard,
  archiveWorkflow,
  duplicateWorkflow,
  changeWorkflowCategory,
} from "@/server/workflow";
export const GET = handler(() => ok({ cards: listWorkflow() }));
export const POST = handler(async (request: Request) => {
  const input = await request.json();
  requireValue(input && typeof input === "object", "Некорректный запрос");
  if (input.action === "create") return ok(createWorkflow(input));
  if (input.action === "duplicate") return ok(duplicateWorkflow(input.id));
  if (input.action === "category") {changeWorkflowCategory(input.id,input.category);return ok({ok:true});}
  if (input.action === "delete" || input.action === "restore") {
    archiveWorkflow(input.id, input.action === "restore");
    return ok({ok:true});
  }
  if (input.action === "update") {
    updateWorkflowCard(input);
    return ok({ ok: true });
  }
  if (input.action === "move") moveWorkflow(input.id, input.status);
  else syncWorkflow(input);
  return ok({ ok: true });
});
