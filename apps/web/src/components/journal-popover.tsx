"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, Search } from "lucide-react";

export function JournalPopover({
  trigger,
  children,
  open,
  onOpenChange,
  label,
  className = "w-72",
  align = "start",
}: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
  label: string;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={`z-[70] max-h-[min(650px,calc(100dvh-32px))] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border bg-card p-2 text-foreground shadow-2xl outline-none ${className}`}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function JournalChoicePicker({
  label,
  options,
  value,
  values,
  onChange,
  onValuesChange,
  placeholder = "Выбрать…",
  onCreate,
  className = "",
  compact = false,
  catalogHref,
  optionHref,
  allowClear = true,
  large = false,
}: {
  label: string;
  options: { value: string; label: string; icon?: ReactNode; chipClassName?: string }[];
  value?: string;
  values?: string[];
  onChange?: (value: string) => void;
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
  onCreate?: (name: string) => void;
  className?: string;
  compact?: boolean;
  catalogHref?: string;
  optionHref?: (value: string) => string;
  allowClear?: boolean;
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = values ?? (value !== undefined ? [value] : []);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );
  const canCreate =
    !!onCreate &&
    !!query.trim() &&
    !options.some((option) => option.label.toLowerCase() === query.trim().toLowerCase());
  const choose = (next: string) => {
    if (onValuesChange)
      onValuesChange(
        selected.includes(next) ? selected.filter((id) => id !== next) : [...selected, next],
      );
    else {
      onChange?.(allowClear && selected.includes(next) ? "" : next);
      setOpen(false);
    }
  };
  return (
    <JournalPopover
      label={label}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      className={`min-w-56 w-[var(--radix-popover-trigger-width)] ${large ? "p-3" : ""}`}
      trigger={
        <button
          type="button"
          aria-label={label}
          className={`flex min-h-8 items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-accent ${compact ? "border" : "w-full"} ${className}`}
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selected.length ? (
              selected.map((id) => (
                <span
                  key={id}
                  className={
                    onValuesChange
                      ? `rounded-md px-2 py-0.5 text-xs ${options.find((option) => option.value === id)?.chipClassName ?? "bg-accent"}`
                      : "truncate"
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {options.find((option) => option.value === id)?.icon}
                    {options.find((option) => option.value === id)?.label ?? placeholder}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      }
    >
      <div
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='option']"),
          );
          if (!buttons.length) return;
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[
            (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }}
      >
        <div className="mb-1 flex items-center gap-2 border-b px-1 pb-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            aria-label={`Поиск: ${label}`}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canCreate) {
                event.preventDefault();
                onCreate?.(query.trim());
                setOpen(false);
              }
            }}
            placeholder="Поиск…"
            className={`w-full bg-transparent outline-none ${large ? "h-10 text-base" : "h-7 text-sm"}`}
          />
        </div>
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable={!!onValuesChange}
          className={`${large ? "max-h-96" : "max-h-64"} overflow-y-auto`}
        >
          {filtered.map((option) => (
            <div key={option.value} className="flex items-center rounded hover:bg-accent">
              <button
                type="button"
                role="option"
                aria-selected={selected.includes(option.value)}
                onClick={() => choose(option.value)}
                className={`flex min-w-0 flex-1 items-center rounded text-left focus:bg-accent focus:outline-none ${large ? "min-h-12 gap-3 px-3 py-2.5 text-base [&>svg]:size-5 [&>[role=img]]:size-6" : "gap-2 px-2 py-1.5 text-sm"}`}
              >
                {option.icon}
                <span className="flex-1">{option.label}</span>
                {selected.includes(option.value) && <Check className="size-3.5" />}
              </button>
              {optionHref && (
                <Link
                  href={`${optionHref(option.value)}&via=relation`}
                  aria-label={`Открыть ${option.label}`}
                  title="Открыть страницу"
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            </div>
          ))}
          {!filtered.length && !canCreate && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Ничего не найдено</p>
          )}
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              onCreate?.(query.trim());
              setOpen(false);
            }}
            className="mt-1 w-full border-t px-2 py-2 text-left text-sm"
          >
            + Создать «{query.trim()}»
          </button>
        )}
        {catalogHref && (
          <Link
            href={`${catalogHref}${catalogHref.includes("?") ? "&" : "?"}via=relation`}
            className="mt-1 flex items-center gap-2 border-t px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowUpRight className="size-3.5" />
            Открыть таблицу справочника
          </Link>
        )}
      </div>
    </JournalPopover>
  );
}
