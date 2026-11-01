import { handler, ok, requireValue } from "@/server/api";
import {
  createSessionEntry,
  listSessionEntries,
  updateSessionEntry,
  archiveSessionEntry,
} from "@/server/session-entries";
export const GET = handler((request: Request) =>
  ok({ entries: listSessionEntries(new URL(request.url).searchParams.get("date") ?? "",(new URL(request.url).searchParams.get('kind')??'day') as 'day'|'week') }),
);
export const POST = handler(async (request: Request) => {
  const body = await request.json();
  requireValue(body && typeof body === "object", "Некорректный запрос");
  if (body.action === "create") return ok({ entry: createSessionEntry(body.date,body.kind??'day') });
  if ((body.action === "delete" || body.action === "restore") && typeof body.id === "string") { archiveSessionEntry(body.id,body.action==='restore'); return ok({saved:true}); }
  requireValue(body.action === "update" && typeof body.id === "string", "Некорректная запись");
  updateSessionEntry(body.id, body.blocks);
  return ok({ saved: true });
});
