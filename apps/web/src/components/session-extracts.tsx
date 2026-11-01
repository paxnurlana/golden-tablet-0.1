"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import {
  workflowInReport,
  workflowSourceLabel,
  WORKFLOW_LABELS,
  WORKFLOW_COLORS,
  type WorkflowCard,
} from "@/lib/workflow";
export function SessionExtracts({ date, kind }: { date: string; kind: "day" | "week" | "month" }) {
  const api = useApi<{ cards: WorkflowCard[] }>("/api/workflow");
  useEffect(() => {
    const refresh = () => api.refresh();
    window.addEventListener("workflow-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("workflow-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [api.refresh]);
  const cards = (api.data?.cards ?? []).filter((card) => workflowInReport(card, date, kind));
  return (
    <section className="space-y-3 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">
          Session Extracts{" "}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{cards.length}</span>
        </h3>
        <Link href="/workflow" className="text-xs text-muted-foreground hover:text-foreground">
          Открыть Workflow ↗
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Все /-пометки{" "}
        {kind === "day" ? "этого дня" : kind === "week" ? "этой недели" : "этого месяца"}, включая
        записи Live Session.
      </p>
      {api.error && (
        <p role="alert" className="text-sm text-destructive">
          {api.error}
        </p>
      )}
      <div className="space-y-2">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={`/workflow?card=${card.id}`}
            className="block rounded-lg border border-border/60 bg-card p-3 hover:bg-accent/50"
            style={{
              borderColor: WORKFLOW_COLORS[card.category],
              backgroundColor: WORKFLOW_COLORS[card.category]
                ? `${WORKFLOW_COLORS[card.category]}0c`
                : undefined,
            }}
          >
            <div className="mb-2 flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{WORKFLOW_LABELS[card.category] || card.category}</span>
              <span>
                {card.status === "doing"
                  ? "В работе"
                  : card.status === "done"
                    ? "Завершено"
                    : "Входящие"}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{card.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">{workflowSourceLabel(card)}</p>
          </Link>
        ))}
        {!cards.length && (
          <p className="text-sm text-muted-foreground">
            {api.loading ? "Загрузка…" : "Пока нет пометок. Напиши / в заметке, чтобы добавить."}
          </p>
        )}
      </div>
    </section>
  );
}
