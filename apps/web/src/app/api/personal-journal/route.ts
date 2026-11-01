import { handler, ok, requireValue } from "@/server/api";
import {
  createPersonalJournalEntry,
  createPersonalJournalTerm,
  listPersonalJournal,
  TERM_KINDS,
  updatePersonalJournalEntry,
  type TermKind,
  archivePersonalJournalEntry,
  restorePersonalJournalEntry,
  updatePersonalJournalTerm,
} from "@/server/personal-journal";

export const GET = handler(() => ok(listPersonalJournal()));

export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as Record<string, unknown>;
  requireValue(body && typeof body === "object", "Некорректный запрос");
  if (body.action === "create") return ok({ entry: createPersonalJournalEntry() });
  if (body.action === "delete" || body.action === "restore") {
    requireValue(typeof body.id === "string", "Некорректная запись");
    if (body.action === "delete") {
      archivePersonalJournalEntry(body.id);
      return ok({ deleted: true });
    }
    return ok({ entry: restorePersonalJournalEntry(body.id) });
  }
  if (body.action === "term") {
    requireValue(
      typeof body.kind === "string" && TERM_KINDS.includes(body.kind as TermKind),
      "Некорректный справочник",
    );
    requireValue(typeof body.name === "string", "Введите название");
    return ok({ term: createPersonalJournalTerm(body.kind as TermKind, body.name) });
  }
  if (body.action === "term-update") {
    requireValue(
      typeof body.id === "string" && body.changes && typeof body.changes === "object",
      "Некорректное изменение справочника",
    );
    const changes = body.changes as Record<string, unknown>;
    requireValue(
      changes.name === undefined || typeof changes.name === "string",
      "Некорректное название",
    );
    requireValue(
      changes.description === undefined || typeof changes.description === "string",
      "Некорректное описание",
    );
    requireValue(
      changes.archived === undefined || typeof changes.archived === "boolean",
      "Некорректный статус",
    );
    return ok({
      term: updatePersonalJournalTerm(
        body.id,
        changes as { name?: string; description?: string; archived?: boolean; logo?: string },
      ),
    });
  }
  if (body.action === "update") {
    requireValue(
      typeof body.id === "string" && body.changes && typeof body.changes === "object",
      "Некорректное обновление",
    );
    const changes=body.changes as Record<string,unknown>;
    const entry=updatePersonalJournalEntry(body.id,changes);
    const renumber=changes.terms!==undefined||changes.tradeNo!==undefined;
    return ok({entry,...(renumber?{numbers:listPersonalJournal().entries.map(e=>({id:e.id,tradeNo:e.tradeNo,numberSeries:e.numberSeries}))}:{})});
  }
  throw new Error("Неизвестное действие");
});
