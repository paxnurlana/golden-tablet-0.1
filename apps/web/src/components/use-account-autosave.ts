"use client";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/use-api";
export function accountDraft<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
// A single serial queue per editor; replacing a pending value never creates another record.
export function useAccountAutosave(
  key: string,
  body: Record<string, unknown>,
  onSaved: () => void,
) {
  const [status, setStatus] = useState("Сохранено"),
    [error, setError] = useState("");
  const latest = useRef(body),
    callback = useRef(onSaved),
    pending = useRef<Record<string, unknown> | null>(null),
    running = useRef(false),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    previous = useRef(JSON.stringify(body));
  latest.current = body;
  callback.current = onSaved;
  const waiters = useRef<(() => void)[]>([]);
  function queue() {
    pending.current = latest.current;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch {
      /* Keep editing even if optional recovery storage is full. */
    }
    if (mounted.current) setStatus("Сохраняется…");
  }
  async function flush() {
    if (JSON.stringify(latest.current) !== previous.current) {
      previous.current = JSON.stringify(latest.current);
      queue();
    }
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (running.current) return new Promise<void>((resolve) => waiters.current.push(resolve));
    running.current = true;
    try {
      while (pending.current) {
        const value = pending.current;
        pending.current = null;
        try {
          await postJson("/api/personal-accounts", value);
          if (!pending.current) {
            try {
              localStorage.removeItem(key);
            } catch {
              /* Optional recovery storage */
            }
            if (mounted.current) {
              setStatus("Сохранено");
              setError("");
            }
            callback.current();
          }
        } catch (e) {
          if (mounted.current) {
            setStatus("Не сохранено");
            setError(e instanceof Error ? e.message : "Ошибка сохранения");
          }
          break;
        }
      }
    } finally {
      running.current = false;
      for (const resolve of waiters.current.splice(0)) resolve();
    }
  }
  const serialized = JSON.stringify(body);
  useEffect(() => {
    if (serialized === previous.current) return;
    previous.current = serialized;
    queue();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 400);
  }, [serialized]);
  useEffect(() => {
    mounted.current = true;
    try {
      if (localStorage.getItem(key)) {
        queue();
        void flush();
      }
    } catch {
      /* Optional draft */
    }
    const retry = () => {
      queue();
      void flush();
    };
    window.addEventListener("online", retry);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", retry);
      void flush();
    };
  }, [key]);
  return {
    status,
    error,
    flush,
    retry: () => {
      queue();
      void flush();
    },
  };
}
