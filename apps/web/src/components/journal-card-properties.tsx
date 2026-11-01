"use client";
import {realisedRR,rrDivisor,type RrBasis} from '@/lib/trade-rr';
import { SlashTextarea } from "@/components/slash-textarea";
import { DETAILS, ACTIVE_DETAILS, EXECUTION_TAGS, resultName, CHARACTER_TONES } from "@/lib/trade-classification";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GripVertical, SlidersHorizontal } from "lucide-react";
import type { JournalEntry, Term, TermKind } from "@/server/personal-journal";
import { JournalPopover, JournalChoicePicker } from "./journal-popover";
import { JournalDatePicker } from "./journal-date-picker";
import { JournalTimeInput } from "./journal-time-input";
import { useJournalReorder } from "./use-journal-reorder";
import { JournalFieldIcon, JournalTermIcon, resultBadgeClass } from "./journal-icons";

const fields = [
  "date",
  "mode",
  "instrument",
  "direction",
  "result",
  "resultDetail",
  "targetHit",
  "executionTags",
  "type",
  "setup",
  "storyline",
  "trigger",
  "vp",
  "vwap",
  "quickNote",
  "openedAt",
  "closedAt",
  "riskTicks",
  "realisedTicks",
  "rrBasis",
  "realisedR",
  "mfe",
  "mae",
  "accounts",
] as const;
type CardField = (typeof fields)[number];
const labels: Record<CardField, string> = {
  date: "Дата",
  mode: "Режим",
  instrument: "Asset",
  direction: "Позиция",
  result: "Результат",
  resultDetail: "Уточнение результата",
  targetHit: "Цель достигнута",
  executionTags: "Характер сделки",
  type: "Type",
  setup: "Setup",
  storyline: "Storyline",
  trigger: "Trigger",
  vp: "VP Context",
  vwap: "VWAP Context",
  quickNote: "Заметка",
  openedAt: "Open Time",
  closedAt: "Close Time",
  riskTicks: "Risk Ticks",
  realisedTicks: "Realised Ticks",
  rrBasis: "База расчёта R",
  realisedR: "Realised RR",
  mfe: "MFE · ticks",
  mae: "MAE · ticks",
  accounts: "Аккаунты",
};
const relations: CardField[] = [
  "instrument",
  "result",
  "setup",
  "storyline",
  "trigger",
  "vp",
  "vwap",
  "type",
];
const numbers: CardField[] = ["riskTicks", "realisedTicks", "realisedR", "mfe", "mae"];
const inputStyle =
  "w-full min-h-8 rounded border border-transparent bg-transparent px-2 py-1.5 text-base outline-none hover:bg-accent/40 focus:border-sky-500";

export function JournalCardProperties({
  entry,
  terms,
  save,
  create,
  accounts,
  settingsContainer,
}: {
  entry: JournalEntry;
  terms: Term[];
  save: (entry: JournalEntry, changes: Record<string, unknown>) => Promise<void>;
  create: (entry: JournalEntry, kind: TermKind, name: string) => Promise<void>;
  accounts: ReactNode;
  settingsContainer: HTMLElement | null;
}) {
  const [order, setOrder] = useState<CardField[]>([...fields]);
  const [hidden, setHidden] = useState<CardField[]>([]);
  const [ready, setReady] = useState(false);
  const propertyContainer = useRef<HTMLDivElement | null>(null);
  const { dragged, target, bind } = useJournalReorder(
    setOrder,
    propertyContainer,
    "data-card-property",
    "y",
  );
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem("journal-card-layout-v1") || "null");
      if (
        Array.isArray(value?.order) &&
        value.order.every((id: CardField) => fields.includes(id))
      ) {
        const next = [...value.order] as CardField[];
        for (const id of fields)
          if (!next.includes(id))
            next.splice(id === "resultDetail" ? next.indexOf("result") + 1 : id === "rrBasis" ? next.indexOf("realisedR") : next.length, 0, id);
        setOrder(next);
      }
      if (Array.isArray(value?.hidden))
        setHidden(value.hidden.filter((id: CardField) => fields.includes(id)));
    } catch {
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("journal-card-layout-v1", JSON.stringify({ order, hidden }));
      } catch {}
  }, [order, hidden, ready]);
  const render = (id: CardField) => {
    if(id==='rrBasis'){
      const basis=entry.rrBasis??{mode:entry.realisedR!=null?'manual' as const:'stop' as const,ticks:50};
      const changeBasis=(next:RrBasis)=>void save(entry,{rrBasis:next,...(next.mode==='manual'?{realisedR:realisedRR(entry)}:{})});
      const divisor=rrDivisor(entry);
      return <div className="space-y-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-2">
          <select aria-label="База расчёта R" value={basis.mode} onChange={e=>changeBasis({...basis,mode:e.target.value as RrBasis['mode']})} className="min-w-0 flex-1 rounded-lg bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-500">
            <option value="standard">Стандартный риск</option><option value="stop">По стопу сделки</option><option value="manual">Вручную</option>
          </select>
          {basis.mode==='standard'&&<label className="flex items-center gap-2 rounded-lg border px-2 text-xs text-muted-foreground">1R = <input aria-label="Стандартный риск в тиках" key={entry.id+String(basis.ticks)} type="number" min="0.000001" step="any" defaultValue={basis.ticks} onBlur={e=>{const ticks=Number(e.target.value);if(Number.isFinite(ticks)&&ticks>0&&ticks!==basis.ticks)changeBasis({...basis,ticks});else e.target.value=String(basis.ticks);}} className="w-16 bg-transparent py-1.5 text-sm text-foreground outline-none"/> тиков</label>}
        </div>
        <p className="px-1 text-xs leading-5 text-muted-foreground">{basis.mode==='manual'?'Реализованный и упущенный RR задаются вручную. Тики и деньги сохраняются отдельно.':`Реализованный и упущенный RR считаются от одной базы${divisor!=null?' · 1R = '+divisor+' тиков':''}. Фактический стоп не меняется.`}</p>
      </div>;
    }
    if(id==='targetHit')return <JournalChoicePicker label="Цель достигнута" large value={entry.classification?.targetHit==null?'':entry.classification.targetHit?'yes':'no'} options={[{value:'',label:'По уточнению / не оценено'},{value:'yes',label:'Да — дошла до цели'},{value:'no',label:'Нет — цель не достигнута'}]} onChange={value=>void save(entry,{classification:{...entry.classification,targetHit:value===''?null:value==='yes'}})}/>;
    if (id === "resultDetail") {
      const results = (entry.terms.result ?? []).map((id) =>
        resultName(terms.find((t) => t.id === id)?.name ?? ""),
      );
      return (
        <JournalChoicePicker
          label="Уточнение результата"
          large
          value={entry.classification?.detail || ""}
          options={[
            { value: "", label: "Не уточнено / не проверено" },
            ...ACTIVE_DETAILS.filter((d) => results.includes(d.result)).map((d) => ({
              value: d.id,
              label: d.label,
            })),
            ...DETAILS.filter(d=>['win-managed','loss-entry'].includes(d.id)&&entry.classification?.detail===d.id&&results.includes(d.result)).map(d=>({value:d.id,label:d.label})),
          ]}
          onChange={(detail) =>
            void save(entry, { classification: { ...entry.classification, detail } })
          }
        />
      );
    }
    if (id === "executionTags")
      return (
        <JournalChoicePicker
          label="Характер сделки"
          large
          values={[...(entry.terms.type ?? []).map(id => `type:${id}`), ...(entry.classification?.tags ?? []).map(tag => `tag:${tag}`)]}
          options={[
            ...terms.filter(t => t.kind === "type" && (!t.archived || entry.terms.type?.includes(t.id))).map(t => ({value:`type:${t.id}`,label:t.name,chipClassName:CHARACTER_TONES[t.name]?.chip,icon:<JournalTermIcon kind="type" name={t.name}/> })),
            ...[...new Set([...EXECUTION_TAGS, ...(entry.classification?.tags ?? [])])].map(tag => ({value:`tag:${tag}`,label:tag,chipClassName:CHARACTER_TONES[tag]?.chip,icon:<JournalTermIcon kind="executionTags" name={tag}/> })),
          ]}
          onValuesChange={(values) =>
            void save(entry, {
              terms: {...entry.terms, type:values.filter(v => v.startsWith("type:")).map(v => v.slice(5))},
              classification: {...entry.classification, tags:values.filter(v => v.startsWith("tag:")).map(v => v.slice(4))},
            })
          }
          onCreate={name => void create(entry,"type",name)}
          catalogHref="/catalogs?kind=type"
        />
      );
    if (id === "date")
      return (
        <JournalDatePicker
          label="Дата записи"
          value={entry.date}
          onChange={(date) => void save(entry, { date })}
        />
      );
    if (id === "mode")
      return (
        <JournalChoicePicker
          label="Режим записи"
          large
          allowClear={false}
          value={entry.mode}
          options={[
            { value: "Forward", label: "Live" },
            { value: "Back", label: "Historical" },
          ]}
          onChange={(value) => void save(entry, { mode: value })}
        />
      );
    if (id === "direction")
      return (
        <JournalChoicePicker
          label="Позиция записи"
          large
          value={entry.direction || undefined}
          options={[
            {
              value: "Long",
              label: "Long",
              icon: <JournalTermIcon kind="direction" name="Long" />,
            },
            {
              value: "Short",
              label: "Short",
              icon: <JournalTermIcon kind="direction" name="Short" />,
            },
          ]}
          onChange={(value) => void save(entry, { direction: value })}
        />
      );
    if (relations.includes(id)) {
      const kind = id as TermKind;
      return (
        <JournalChoicePicker
          label={`Выбор: ${labels[id]}`}
          large
          values={entry.terms[kind] ?? []}
          options={terms
            .filter(
              (term) =>
                term.kind === kind &&
                (!term.archived || (entry.terms[kind] ?? []).includes(term.id)),
            )
            .map((term) => ({
              value: term.id,
              label: term.name,
              icon:
                <JournalTermIcon kind={kind} name={term.name} />,
              chipClassName:
                kind === "result" ? `${resultBadgeClass(term.name)} font-semibold` : undefined,
            }))}
          onValuesChange={(values) =>
            void save(entry, {
              terms: {
                ...entry.terms,
                [kind]: kind === "result" && values.length > 1 ? [values.at(-1)!] : values,
              },
            })
          }
          onCreate={kind === "result" ? undefined : (name) => void create(entry, kind, name)}
          catalogHref={`/catalogs?kind=${kind}`}
          optionHref={(id) => `/catalogs?kind=${kind}&term=${id}`}
        />
      );
    }
    if (id === "accounts") return accounts;
    if (id === "quickNote")
      return (
        <AutoNote
          key={`${entry.id}-note`}
          value={entry.quickNote}
          onCommit={(value) => {
            if (value !== entry.quickNote) void save(entry, { quickNote: value });
          }}
        />
      );
    if (numbers.includes(id)) {
      const key = id as "riskTicks" | "realisedTicks" | "realisedR" | "mfe" | "mae";
      return (
        <input
          aria-label={labels[id]}
          key={`${entry.id}-${id}-${id==='realisedR'?realisedRR(entry):entry[key]}`}
          type="number"
          step="any"
          defaultValue={(id==='realisedR'?realisedRR(entry):entry[key]) ?? ""}
          onBlur={(event) => {
            const value = event.target.value === "" ? null : Number(event.target.value);
            if (value !== (id==='realisedR'?realisedRR(entry):entry[key])) void save(entry, { [key]: value,...(id==='realisedR'?{rrBasis:{...(entry.rrBasis??{ticks:50}),mode:'manual'}}:{}) });
          }}
          className={inputStyle}
        />
      );
    }
    const key = id as "openedAt" | "closedAt";
    return (
      <JournalTimeInput
        key={`${entry.id}-${id}`}
        label={labels[id]}
        value={entry[key]}
        onCommit={(value) => void save(entry, { [key]: value })}
        className={inputStyle}
      />
    );
  };
  return (
    <div ref={propertyContainer} onKeyDown={event=>{
      if(event.key!=='Enter'||event.nativeEvent.isComposing) return;
      const field=event.target;
      if(!(field instanceof HTMLInputElement)||field.type==='checkbox'||field.type==='file'||field.getAttribute('aria-label')?.startsWith('Поиск:'))return;
      event.preventDefault();
      field.blur();
    }}>
      {settingsContainer &&
        createPortal(
          <JournalPopover
            label="Настройка свойств карточки"
            align="end"
            className="w-64"
            trigger={
              <button
                type="button"
                aria-label="Свойства"
                title="Свойства карточки"
                className="grid size-7 place-items-center rounded-[10px] border border-white/5 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <SlidersHorizontal className="size-3.5" />
              </button>
            }
          >
            <p className="border-b px-2 py-2 text-xs text-muted-foreground">
              Показывать во всех карточках
            </p>
            {order.filter(id => id !== "type").map((id) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={!hidden.includes(id)}
                  onChange={(event) =>
                    setHidden((old) =>
                      event.target.checked ? old.filter((item) => item !== id) : [...old, id],
                    )
                  }
                />
                {labels[id]}
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                setOrder([...fields]);
                setHidden([]);
              }}
              className="mt-2 w-full border-t px-2 py-2 text-left text-xs text-muted-foreground"
            >
              Сбросить расположение
            </button>
          </JournalPopover>,
          settingsContainer,
        )}
      {order
        .filter((id) => id !== "type" && !hidden.includes(id))
        .map((id) => (
          <div
            key={id}
            data-card-property={id}
            className={`group relative grid grid-cols-[20px_minmax(0,1fr)] gap-2 border-b border-white/[0.04] py-1 ${dragged === id ? "opacity-40" : ""}`}
          >
            <button
              type="button"
              {...bind(id)}
              aria-label={`Переместить: ${labels[id]}`}
              title="Перетащи свойство"
              className="flex h-8 w-5 cursor-grab touch-none items-center justify-center self-start rounded text-muted-foreground opacity-30 hover:bg-accent group-hover:opacity-100 focus:opacity-100"
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                event.preventDefault();
                setOrder((old) => {
                  const visible = old.filter((item) => !hidden.includes(item));
                  const targetId =
                    visible[visible.indexOf(id) + (event.key === "ArrowDown" ? 1 : -1)];
                  if (!targetId) return old;
                  const next = [...old];
                  const from = next.indexOf(id),
                    to = next.indexOf(targetId);
                  [next[from], next[to]] = [next[to]!, next[from]!];
                  return next;
                });
              }}
            >
              <GripVertical className="size-3.5" />
            </button>
            <div className="grid grid-cols-[124px_minmax(0,1fr)] items-start gap-2 max-sm:grid-cols-1 max-sm:gap-0">
              <span className="flex min-h-8 items-center gap-2 text-base text-muted-foreground">
                <JournalFieldIcon field={id} />
                {labels[id]}
              </span>
              <div className="min-w-0">{render(id)}</div>
            </div>
            {target?.id === id && dragged && (
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-sky-400 ${target.edge === "before" ? "top-0" : "bottom-0"}`}
              />
            )}
          </div>
        ))}
    </div>
  );
}

function AutoNote({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const grow = () => {
    const element = ref.current;
    if (element) {
      const original = element.value;
      if (document.activeElement !== element) element.value = original.replace(/\n+$/, "");
      element.style.height = "auto";
      element.style.height = `${Math.max(34, element.scrollHeight + 2)}px`;
      element.value = original;
    }
  };
  useEffect(grow, [value]);
  return (
    <SlashTextarea
      ref={ref}
      rows={1}
      aria-label="Заметка сделки"
      defaultValue={value}
      onInput={grow}
      onFocus={grow}
      onBlur={(event) => {
        onCommit(event.target.value);
        grow();
      }}
      placeholder="Краткая суть для поиска и анализа"
      className={`${inputStyle.replace("text-base", "text-sm")} min-h-8 resize-none overflow-hidden leading-5 [overflow-wrap:anywhere]`}
    />
  );
}
