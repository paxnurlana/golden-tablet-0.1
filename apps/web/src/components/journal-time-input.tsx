"use client";
import { useEffect, useState } from "react";
export function JournalTimeInput({
  value,
  label,
  onCommit,
  className,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  className: string;
}) {
  const [text, setText] = useState(value),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      aria-invalid={invalid}
      placeholder="ЧЧ:ММ"
      value={text}
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.currentTarget.select()}
      onMouseUp={(event) => event.preventDefault()}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
        setText(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
        setInvalid(false);
      }}
      onBlur={() => {
        if (text === "") {
          if (value) onCommit("");
          return;
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
          setInvalid(true);
          return;
        }
        if (text !== value) onCommit(text);
      }}
      className={`${className} tabular-nums ${invalid ? "border-rose-500" : ""}`}
      title={invalid ? "Введите время от 00:00 до 23:59" : undefined}
    />
  );
}
