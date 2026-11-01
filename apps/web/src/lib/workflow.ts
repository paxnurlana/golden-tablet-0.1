export const WORKFLOW_CATEGORIES = ["задача", "идея", "мысль", "вопрос", "research", "playbook", "закон"];
export const WORKFLOW_COLORS: Record<string, string> = {
  закон: "#e2e8f0",
  задача: "#34d399",
  идея: "#60a5fa",
  вопрос: "#facc15",
  мысль: "#c084fc",
  research: "#2dd4bf",
  playbook: "#fb923c",
};
export const WORKFLOW_LABELS: Record<string, string> = {
  закон: "Законы",
  задача: "Задачи",
  идея: "Идеи",
  мысль: "Мысли",
  вопрос: "Вопросы",
  research: "Research / Проверить",
  playbook: "Playbook Candidates",
};
export type WorkflowCard = {
  status_changed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  sourceImages?: { id: string; name: string }[];
  blocks?: import("@/server/personal-journal").JournalBodyBlock[];
  id: string;
  source: string;
  url: string;
  label: string;
  slot: number;
  category: string;
  text: string;
  status: "inbox" | "doing" | "done";
  detached: boolean;
};
export type WorkflowSort = "oldest" | "newest" | "updated" | "name";
export function sortWorkflowCards(cards: WorkflowCard[], sort: WorkflowSort) {
  return [...cards].sort((a, b) => {
    if (sort === "name") return a.text.localeCompare(b.text, "ru") || a.id.localeCompare(b.id);
    const field = sort === "updated" ? "updated_at" : "created_at";
    const order = (a[field] ?? a.updated_at ?? "").localeCompare(b[field] ?? b.updated_at ?? "");
    return (sort === "oldest" ? order : -order) || a.id.localeCompare(b.id);
  });
}
export function workflowCommands(text: string) {
  const matches = [
    ...text.matchAll(/(?:^|\s)\/([\p{L}\p{N}_-]{1,40})[ \t]+([^\n]*(?:\n\t[^\n]*)*)/gu),
  ];
  return matches
    .map((match, slot) => ({
      slot,
      category: match[1]!.toLowerCase(),
      text: match[2]!.replaceAll("\n\t", "\n").trim(),
    }))
    .filter((item) => item.text);
}
export function workflowReportContext(card: Pick<WorkflowCard, "url">) {
  const url = new URL(card.url, "http://local");
  const kind = url.searchParams.get("review");
  const date = url.searchParams.get("date");
  return ["day", "week", "month"].includes(kind ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
    ? { kind: kind!, date: date! }
    : null;
}
export function workflowSourceLabel(card: Pick<WorkflowCard, "url" | "label">) {
  if (/Daily Review|Weekly Review|Month Review|Journal ·/.test(card.label)) return card.label;
  const context = workflowReportContext(card);
  return context
    ? `${context.kind === "day" ? "Daily Review" : context.kind === "week" ? "Weekly Review" : "Month Review"} · ${context.date} · ${card.label}`
    : card.label;
}
export function workflowInReport(card: WorkflowCard, key: string, kind: "day" | "week" | "month") {
  if (card.detached) return false;
  const context = workflowReportContext(card);
  if (!context) return false;
  if (context.kind === kind && context.date === key) return true;
  if (context.kind !== "day") return false;
  if (kind === "month") return context.date.slice(0, 7) === key.slice(0, 7);
  if (kind === "week") {
    const end = new Date(`${key}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return context.date >= key && context.date <= end.toISOString().slice(0, 10);
  }
  return false;
}
