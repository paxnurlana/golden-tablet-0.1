"use client";

import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Columns3,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import { ru } from "react-day-picker/locale";
import type { Term } from "@/server/personal-journal";
import { Calendar } from "@/components/ui/calendar";
import { JournalChoicePicker, JournalPopover } from "./journal-popover";
import {JournalSegmentControl} from './journal-segment-control';
import type {JournalTradeScope} from '@/lib/journal-trade-scope';
import {JournalTermIcon} from './journal-icons';
import {JournalAccountAvatar} from './journal-account-avatar';

export function FilterValueIcon({term}:{term:Term}){
  if(term.kind==='account')return <JournalAccountAvatar term={term} size="size-5"/>;
  return <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden="true">{term.logo?<img src={term.logo} alt="" className="size-5 object-contain"/>:<JournalTermIcon kind={term.kind} name={term.name}/>}</span>;
}
import { JournalDateTextInput } from "./journal-date-picker";
import {
  activeFilterCount,
  FILTER_PROPERTIES,
  newRule,
  operators,
  periodBounds,
  localDateKey,
  formatJournalDate,
  MODE_LABELS,
  type FilterGroup,
  type FilterNode,
  type FilterRule,
  type Period,
} from "@/lib/journal-filters";

const presets: { value: Period["preset"]; label: string }[] = [
  { value: "all", label: "Все даты" },
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Эта неделя" },
  { value: "month", label: "Этот месяц" },
  { value: "year", label: "Этот год" },
];
const control =
  "min-h-8 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:border-sky-500";
const displayDate = formatJournalDate;

export function JournalToolbar({
  period,
  onPeriod,
  mode,
  onMode,
  tradeScope='All',
  onTradeScope=()=>{},
  filters,
  onFilters,
  query,
  onQuery,
  terms,
  columns,
  hidden,
  onHidden,
  onCreate,
}: {
  period: Period;
  onPeriod: (value: Period) => void;
  mode: "All" | "Forward" | "Back";
  onMode: (value: "All" | "Forward" | "Back") => void;
  tradeScope?:JournalTradeScope;
  onTradeScope?:(value:JournalTradeScope)=>void;
  filters: FilterGroup;
  onFilters: (value: FilterGroup) => void;
  query: string;
  onQuery: (value: string) => void;
  terms: Term[];
  columns: { id: string; label: string }[];
  hidden: string[];
  onHidden: (value: string[]) => void;
  onCreate: () => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const editing = filters.children.find(
    (node): node is FilterRule => node.kind === "rule" && node.id === editingId,
  );
  const updateRule = (rule: FilterRule) =>
    onFilters({
      ...filters,
      children: filters.children.map((node) => (node.id === rule.id ? rule : node)),
    });
  const count = activeFilterCount(filters);
  const resetFilters = () => {
    onFilters({ ...filters, children: [] });
    onQuery("");
    setEditingId(null);
    setFieldSearch("");
    setFilterOpen(false);
  };
  const bounds = periodBounds(period);
  const periodLabel =
    presets.find((item) => item.value === period.preset)?.label ??
    (period.from
      ? `${displayDate(period.from)}${period.to && period.to !== period.from ? ` — ${displayDate(period.to)}` : ""}`
      : "Выбрать даты");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <JournalPopover
          label="Период журнала"
          open={dateOpen}
          onOpenChange={setDateOpen}
          className="w-[310px]"
          trigger={
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-full bg-accent/70 px-3 text-sm font-medium hover:bg-accent"
            >
              <CalendarDays className="size-4 text-muted-foreground" />
              {periodLabel}
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          }
        >
          <div className="mb-2 grid grid-cols-2 gap-1">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.value}
                onClick={() => {
                  onPeriod({ preset: preset.value, from: "", to: "" });
                  setDateOpen(false);
                }}
                className={`rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${period.preset === preset.value ? "bg-accent" : ""}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex gap-2 border-t pt-3">
            <label className="min-w-0 flex-1 text-xs text-muted-foreground">
              С
              <JournalDateTextInput
                label="Начало периода"
                value={period.preset === "custom" ? period.from : bounds.from}
                onChange={(value) =>
                  onPeriod({
                    preset: "custom",
                    from: value,
                    to: period.preset === "custom" ? period.to : bounds.to,
                  })
                }
                className={`${control} mt-1 w-full px-1 text-xs`}
              />
            </label>
            <label className="min-w-0 flex-1 text-xs text-muted-foreground">
              По
              <JournalDateTextInput
                label="Конец периода"
                value={period.preset === "custom" ? period.to : bounds.to}
                onChange={(value) =>
                  onPeriod({
                    preset: "custom",
                    from: period.preset === "custom" ? period.from : bounds.from,
                    to: value,
                  })
                }
                className={`${control} mt-1 w-full px-1 text-xs`}
              />
            </label>
          </div>
          <Calendar
            mode="range"
            locale={ru}
            weekStartsOn={1}
            selected={
              period.preset === "custom" && period.from
                ? {
                    from: new Date(`${period.from}T12:00:00`),
                    to: period.to ? new Date(`${period.to}T12:00:00`) : undefined,
                  }
                : undefined
            }
            onSelect={(range) =>
              onPeriod({
                preset: "custom",
                from: range?.from ? localDateKey(range.from) : "",
                to: range?.to ? localDateKey(range.to) : "",
              })
            }
          />
        </JournalPopover>
        <div className="flex flex-wrap items-center gap-2">
          <JournalSegmentControl label="Режим журнала" value={mode} onChange={onMode} options={[{value:'Forward',label:'Live'},{value:'Back',label:'Historical'},{value:'All',label:'All'}]}/>
          <JournalSegmentControl label="Тип сделок" value={tradeScope} onChange={onTradeScope} options={[{value:'Realised',label:'Realised'},{value:'Unrealised',label:'Unrealised'},{value:'All',label:'All trades'}]}/>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <JournalPopover
            label="Фильтры журнала"
            open={filterOpen}
            onOpenChange={(open) => {
              setFilterOpen(open);
              if (!open) {
                setEditingId(null);
                setFieldSearch("");
              }
            }}
            className={advanced ? "w-[620px]" : "w-[350px]"}
            align="end"
            trigger={
              <button
                type="button"
                className={`flex h-8 items-center gap-1.5 rounded px-2 text-sm hover:bg-accent ${count || query ? "text-sky-400" : "text-muted-foreground"}`}
              >
                <Filter className="size-4" />
                Фильтр
                {count > 0 && <span className="rounded bg-sky-500/15 px-1 text-xs">{count}</span>}
              </button>
            }
          >
            {advanced ? (
              <>
                <div className="mb-2 flex items-center justify-between border-b px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => setAdvanced(false)}
                    className="flex items-center gap-2 text-sm"
                  >
                    <ArrowLeft className="size-3.5" />
                    Расширенный фильтр
                  </button>
                  <button
                    type="button"
                    onClick={() => onFilters({ ...filters, children: [] })}
                    className="text-xs text-muted-foreground"
                  >
                    Сбросить
                  </button>
                </div>
                <FilterGroupEditor group={filters} terms={terms} depth={0} onChange={onFilters} />
              </>
            ) : editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="mb-3 flex items-center gap-2 px-2 text-sm text-muted-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  Выбрать другое поле
                </button>
                <FilterRuleEditor rule={editing} terms={terms} onChange={updateRule} />
                <button
                  type="button"
                  onClick={() => {
                    onFilters({
                      ...filters,
                      children: filters.children.filter((node) => node.id !== editing.id),
                    });
                    setEditingId(null);
                  }}
                  className="mt-3 w-full border-t px-2 py-2 text-left text-xs text-muted-foreground"
                >
                  Удалить фильтр
                </button>
              </>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-2 rounded border px-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    aria-label="Найти поле фильтра"
                    value={fieldSearch}
                    onChange={(event) => setFieldSearch(event.target.value)}
                    placeholder="Фильтровать по…"
                    className="h-8 w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {FILTER_PROPERTIES.filter((property) =>
                    property.label.toLowerCase().includes(fieldSearch.toLowerCase()),
                  ).map((property) => (
                    <button
                      type="button"
                      key={property.key}
                      onClick={() => {
                        const rule = newRule(property.key);
                        onFilters({ ...filters, children: [...filters.children, rule] });
                        setEditingId(rule.id);
                        setFieldSearch("");
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="w-5 text-center text-muted-foreground">
                        {property.type === "number"
                          ? "#"
                          : property.type === "date"
                            ? "▣"
                            : property.type === "relation"
                              ? "↗"
                              : "≡"}
                      </span>
                      {property.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAdvanced(true)}
                  className="mt-1 flex w-full items-center gap-2 border-t px-2 py-2 text-left text-sm text-muted-foreground"
                >
                  <Plus className="size-4" />
                  Добавить расширенный фильтр
                </button>
                <div className="flex items-center gap-2 border-t px-2 pt-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    aria-label="Поиск по журналу"
                    value={query}
                    onChange={(event) => onQuery(event.target.value)}
                    placeholder="Поиск по записям…"
                    className="h-8 w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </>
            )}
          </JournalPopover>
          {(filters.children.length > 0 || query) && <button
            type="button"
            aria-label="Быстро сбросить фильтры и поиск"
            title="Сбросить условия и поиск · период не изменится"
            onClick={resetFilters}
            className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          ><X className="size-3.5" />Сбросить</button>}
          <JournalPopover
            label="Столбцы журнала"
            align="end"
            className="w-64"
            trigger={
              <button
                type="button"
                aria-label="Столбцы"
                className="flex h-8 items-center gap-1.5 rounded px-2 text-sm text-muted-foreground hover:bg-accent"
              >
                <Columns3 className="size-4" />
                Столбцы
              </button>
            }
          >
            <p className="px-2 py-2 text-xs font-medium text-muted-foreground">
              Показывать в таблице
            </p>
            {columns.map((column) => (
              <label
                key={column.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={!hidden.includes(column.id)}
                  onChange={(event) =>
                    onHidden(
                      event.target.checked
                        ? hidden.filter((id) => id !== column.id)
                        : [...hidden, column.id],
                    )
                  }
                />
                {column.label}
              </label>
            ))}
          </JournalPopover>
          <button
            type="button"
            onClick={onCreate}
            className="ml-1 flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" />
            Новая запись
          </button>
        </div>
      </div>
      {(filters.children.length > 0 || query) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          {filters.children.map((node) =>
            node.kind === "rule" ? (
              <JournalPopover
                key={node.id}
                label="Редактировать фильтр"
                className="w-[390px]"
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-400"
                  >
                    {ruleLabel(node, terms)}
                    <ChevronDown className="size-3" />
                  </button>
                }
              >
                <FilterRuleEditor rule={node} terms={terms} onChange={updateRule} />
                <button
                  type="button"
                  onClick={() =>
                    onFilters({
                      ...filters,
                      children: filters.children.filter((item) => item.id !== node.id),
                    })
                  }
                  className="mt-2 border-t px-2 py-2 text-xs text-muted-foreground"
                >
                  Удалить фильтр
                </button>
              </JournalPopover>
            ) : (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  setAdvanced(true);
                  setFilterOpen(true);
                }}
                className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-400"
              >
                Группа · {activeFilterCount(node)} условий
              </button>
            ),
          )}
          {query && (
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-400">
              Поиск: {query}
            </span>
          )}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Сбросить
          </button>
        </div>
      )}
    </div>
  );
}

function ruleLabel(rule: FilterRule, terms: Term[]) {
  const property = FILTER_PROPERTIES.find((item) => item.key === rule.property)!;
  const operation = operators(property.type).find(([key]) => key === rule.operator)?.[1] ?? "";
  const value =
    property.type === "relation"
      ? rule.values.map((id) => terms.find((term) => term.id === id)?.name ?? "?").join(", ")
      : rule.property === "mode"
        ? (MODE_LABELS[rule.value as keyof typeof MODE_LABELS] ?? rule.value)
        : rule.value;
  return `${property.label}: ${operation}${value ? ` ${value}` : ""}${rule.end ? ` — ${rule.end}` : ""}`;
}

function FilterGroupEditor({
  group,
  terms,
  depth,
  onChange,
}: {
  group: FilterGroup;
  terms: Term[];
  depth: number;
  onChange: (group: FilterGroup) => void;
}) {
  const replace = (index: number, value: FilterNode) =>
    onChange({
      ...group,
      children: group.children.map((child, i) => (i === index ? value : child)),
    });
  return (
    <div className={depth ? "rounded border bg-background/30 p-2" : "space-y-2"}>
      {group.children.length > 1 && (
        <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <span>Совпадают</span>
          <JournalChoicePicker
            compact
            label={`Логика группы ${depth + 1}`}
            allowClear={false}
            value={group.conjunction}
            onChange={(value) => onChange({ ...group, conjunction: value as "and" | "or" })}
            options={[
              { value: "and", label: "Все условия · И" },
              { value: "or", label: "Любое условие · ИЛИ" },
            ]}
          />
        </div>
      )}
      {group.children.map((node, index) => (
        <div key={node.id} className="mb-2 flex items-start gap-1">
          <span className="w-8 shrink-0 pt-2 text-center text-xs text-muted-foreground">
            {index === 0 ? "Где" : group.conjunction === "and" ? "И" : "ИЛИ"}
          </span>
          <div className="min-w-0 flex-1">
            {node.kind === "group" ? (
              <FilterGroupEditor
                group={node}
                terms={terms}
                depth={depth + 1}
                onChange={(value) => replace(index, value)}
              />
            ) : (
              <FilterRuleEditor
                rule={node}
                terms={terms}
                onChange={(value) => replace(index, value)}
              />
            )}
          </div>
          <button
            type="button"
            aria-label="Удалить условие"
            onClick={() =>
              onChange({ ...group, children: group.children.filter((_, i) => i !== index) })
            }
            className="rounded p-2 text-muted-foreground hover:bg-accent"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <JournalChoicePicker
          compact
          label="Добавить фильтр"
          placeholder="+ Добавить фильтр"
          options={FILTER_PROPERTIES.map((property) => ({
            value: property.key,
            label: property.label,
          }))}
          onChange={(value) =>
            onChange({ ...group, children: [...group.children, newRule(value)] })
          }
        />
        {depth < 2 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...group,
                children: [
                  ...group.children,
                  {
                    kind: "group",
                    id: crypto.randomUUID(),
                    conjunction: "or",
                    children: [newRule()],
                  },
                ],
              })
            }
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            + Группа условий
          </button>
        )}
      </div>
    </div>
  );
}

function FilterRuleEditor({
  rule,
  terms,
  onChange,
}: {
  rule: FilterRule;
  terms: Term[];
  onChange: (value: FilterRule) => void;
}) {
  const property = FILTER_PROPERTIES.find((item) => item.key === rule.property)!;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <JournalChoicePicker
        compact
        label="Поле фильтра"
        allowClear={false}
        value={rule.property}
        options={FILTER_PROPERTIES.map((item) => ({ value: item.key, label: item.label }))}
        onChange={(value) => onChange({ ...newRule(value), id: rule.id })}
      />
      <JournalChoicePicker
        compact
        label="Условие фильтра"
        allowClear={false}
        value={rule.operator}
        options={operators(property.type).map(([value, label]) => ({ value, label }))}
        onChange={(value) => onChange({ ...rule, operator: value })}
      />
      {!["empty", "notEmpty"].includes(rule.operator) && (
        <>
          {property.type === "relation" ? (
            <JournalChoicePicker
              compact
              label={`Значение: ${property.label}`}
              values={rule.values}
              placeholder="Выбрать значение"
              options={terms
                .filter((term) => term.kind === property.key)
                .map((term) => ({ value: term.id, label: term.name,icon:<FilterValueIcon term={term}/> }))}
              onValuesChange={(values) => onChange({ ...rule, values })}
            />
          ) : property.type === "choice" ? (
            <JournalChoicePicker
              compact
              label={`Значение: ${property.label}`}
              value={rule.value || undefined}
              options={(property.options ?? []).map((value) => ({
                value,
                label:
                  property.key === "mode" ? MODE_LABELS[value as keyof typeof MODE_LABELS] : value,
                icon:property.key==='direction'?<JournalTermIcon kind="direction" name={value}/>:undefined,
              }))}
              onChange={(value) => onChange({ ...rule, value })}
            />
          ) : property.type === "date" ? (
            <JournalDateTextInput
              label={`Значение: ${property.label}`}
              value={rule.value}
              onChange={(value) => onChange({ ...rule, value })}
              className="w-36"
            />
          ) : (
            <input
              aria-label={`Значение: ${property.label}`}
              type={
                property.type === "number" ? "number" : property.type === "time" ? "time" : "text"
              }
              step="any"
              value={rule.value}
              onChange={(event) => onChange({ ...rule, value: event.target.value })}
              placeholder="Значение"
              className={`${control} min-w-24 max-w-44`}
            />
          )}
          {rule.operator === "between" &&
            (property.type === "time" ? (
              <input
                aria-label="Конец диапазона времени"
                type="time"
                value={rule.end}
                onChange={(event) => onChange({ ...rule, end: event.target.value })}
                className={control}
              />
            ) : (
              <JournalDateTextInput
                label="Конец диапазона фильтра"
                value={rule.end}
                onChange={(value) => onChange({ ...rule, end: value })}
                className={control}
              />
            ))}
        </>
      )}
    </div>
  );
}
