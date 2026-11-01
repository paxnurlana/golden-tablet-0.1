import { handler, ok, requireValue } from "@/server/api";
import {
  listPersonalAccounts,
  savePersonalAccount,
  saveFirm,
  addMovement,
  createAccountDraft,
  createFirmDraft,
  removeMovement,
  archiveFirm,
} from "@/server/personal-accounts";
export const GET = handler(() => ok(listPersonalAccounts()));
export const POST = handler(async (request: Request) => {
  const body = await request.json();
  requireValue(body && typeof body === "object", "Некорректный запрос");
  if (body.action === "save") return ok(savePersonalAccount(body));
  if (body.action === "firm") return ok(saveFirm(body));
  if (body.action === "movement") return ok(addMovement(body));
  if (body.action === "account-create") return ok(createAccountDraft(body));
  if (body.action === "firm-create") return ok(createFirmDraft(body));
  if (body.action === "movement-remove") return ok(removeMovement(body));
  if (body.action === "firm-remove") return ok(archiveFirm(body));
  requireValue(false, "Неизвестное действие");
});
