"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { Calendar } from "./ui/calendar";
import { JournalPopover } from "./journal-popover";
import { formatJournalDate, localDateKey, parseJournalDate } from "@/lib/journal-filters";

export function JournalDateTextInput({
  value,
  onChange,
  label,
  className = "",
  allowEmpty = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(formatJournalDate(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(formatJournalDate(value));
    setInvalid(false);
  }, [value]);
  const commit = () => {
    const parsed = parseJournalDate(text);
    if (parsed === null || (!allowEmpty && !parsed)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatJournalDate(parsed));
    if (parsed !== value) onChange(parsed);
  };
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? "Введите существующую дату: дд.мм.гггг" : undefined}
      type="text"
      inputMode="numeric"
      placeholder="дд.мм.гггг"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      className={`min-h-8 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:border-sky-500 ${invalid ? "border-rose-500" : ""} ${className}`}
    />
  );
}

export function JournalDatePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <JournalPopover
      label={label}
      open={open}
      onOpenChange={setOpen}
      className="w-[290px]"
      trigger={
        <button
          type="button"
          aria-label={label}
          className="flex min-h-8 w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
        >
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {formatJournalDate(value) || "Выбрать дату"}
        </button>
      }
    >
      <JournalDateTextInput
        label={`Ввод: ${label}`}
        value={value}
        onChange={onChange}
        allowEmpty={false}
        className="mb-3 w-full"
      />
      <Calendar
        mode="single"
        locale={ru}
        weekStartsOn={1}
        defaultMonth={value ? new Date(`${value}T12:00:00`) : undefined}
        selected={value ? new Date(`${value}T12:00:00`) : undefined}
        onSelect={(date) => {
          if (date) {
            onChange(localDateKey(date));
            setOpen(false);
          }
        }}
      />
    </JournalPopover>
  );
}
