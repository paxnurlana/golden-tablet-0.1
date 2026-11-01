"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { captureReturnPosition, restoreReturnPosition } from "@/lib/return-position";

type Visit = { url: string; label: string };
const storageKey = "golden-navigation-trail-v1";
const names: Record<string, string> = {
  "/": "Dashboard",
  "/workflow": "Workflow",
  "/journal": "Trading Review",
  "/trades": "Journal",
  "/playbooks": "Playbooks",
  "/accounts": "Аккаунты",
  "/calendar": "Calendar",
  "/catalogs": "Trade Library",
  "/reports": "Reports",
  "/notebook": "Notebook",
  "/progress": "Progress",
};
function title(url: string) {
  const parsed = new URL(url, "http://local");
  const name = names[parsed.pathname] || parsed.pathname.split("/").filter(Boolean).join(" · ");
  const review = parsed.searchParams.get("review");
  if (review)
    return `${review === "day" ? "День" : review === "week" ? "Неделя" : "Месяц"} · ${parsed.searchParams.get("date") || ""}`;
  if (parsed.searchParams.has("card")) return "Карточка Workflow";
  if (parsed.pathname === "/accounts" && parsed.searchParams.has("account"))
    return "Карточка аккаунта";
  if (parsed.pathname === "/accounts" && parsed.searchParams.has("firm")) return "Карточка фирмы";
  if (parsed.searchParams.has("entry")) return "Сделка Journal";
  return name;
}

export function NavigationTrail() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const query = search.toString();
  const intent = useRef<{
    kind: "linked" | "section" | "return";
    from: string;
    time: number;
  } | null>(null);
  const returning = useRef<string | null>(null);
  const restoreCleanup = useRef<(() => void) | null>(null);
  const currentUrl = () => location.pathname + location.search + location.hash;
  const jump = (url: string) => {
    if (url === currentUrl()) return;
    captureReturnPosition(currentUrl());
    intent.current = { kind: "return", from: currentUrl(), time: Date.now() };
    returning.current = url;
    router.push(url, { scroll: false });
  };
  useEffect(() => {
    const capture = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('[aria-label="Цепочка переходов"]')) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        anchor &&
        (anchor.target === "_blank" ||
          anchor.hasAttribute("download") ||
          new URL(anchor.href, location.href).origin !== location.origin)
      )
        return;
      const section = Boolean(
        target.closest(".journal-sidebar-nav-link,.journal-sidebar-home,.journal-header-home"),
      );
      const kind = section ? "section" : "linked";
      captureReturnPosition(currentUrl());
      intent.current = { kind, from: currentUrl(), time: Date.now() };
    };
    const back = () => {
      returning.current = currentUrl();
    };
    document.addEventListener("click", capture, true);
    window.addEventListener("popstate", back);
    return () => {
      document.removeEventListener("click", capture, true);
      window.removeEventListener("popstate", back);
      restoreCleanup.current?.();
    };
  }, []);
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 2);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    element.scrollLeft = element.scrollWidth;
    return () => observer.disconnect();
  }, [visits]);
  useEffect(() => {
    const record = () => {
      const url = location.pathname + location.search + location.hash;
      let previous: Visit[] = [];
      try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
        if (Array.isArray(stored))
          previous = stored
            .filter(
              (item) =>
                typeof item.url === "string" &&
                /^\/(?!\/)/.test(item.url) &&
                typeof item.label === "string",
            )
            .slice(-30);
      } catch {
        /* Navigation remains usable without storage. */
      }
      const index = previous.findIndex((item) => item.url === url);
      const parsed = new URL(url, "http://local");
      const pending = intent.current;
      const internal =
        pending?.kind === "linked" && pending.from !== url && Date.now() - pending.time < 10000;
      const section =
        pending?.kind === "section" && pending.from !== url && Date.now() - pending.time < 10000;
      const detail =
        (parsed.pathname === "/catalogs" &&
          (parsed.searchParams.get("via") === "relation" || parsed.searchParams.has("term"))) ||
        parsed.searchParams.has("card") ||
        parsed.searchParams.has("account") ||
        parsed.searchParams.has("firm") ||
        parsed.searchParams.has("entry") ||
        parsed.searchParams.has("review") ||
        parsed.hash.startsWith("#workflow=");
      if (internal && pending && !previous.some((v) => v.url === pending.from))
        previous.push({ url: pending.from, label: title(pending.from) });
      const source = pending ? new URL(pending.from, "http://local") : null;
      const identity = (u: URL) =>
        ["card", "entry", "account", "firm", "review", "date", "term", "kind"]
          .map((k) => u.searchParams.get(k) || "")
          .join("|");
      const sameView =
        internal && source?.pathname === parsed.pathname && identity(source) === identity(parsed);
      const next =
        section || (!detail && !internal && returning.current !== url)
          ? [{ url, label: title(url) }]
          : index >= 0
            ? previous.slice(0, index + 1)
            : sameView
              ? [...previous.slice(0, -1), { url, label: title(url) }]
              : [...previous, { url, label: title(url) }].slice(-30);
      if (pending?.from !== url) intent.current = null;
      if (returning.current !== url && pending?.from !== url) returning.current = null;
      setVisits(next);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Optional persistence. */
      }
      if (returning.current === url) {
        returning.current = null;
        restoreCleanup.current?.();
        restoreCleanup.current = restoreReturnPosition(url);
      }
    };
    record();
    window.addEventListener("hashchange", record);
    return () => window.removeEventListener("hashchange", record);
  }, [pathname, query]);
  const content = (
    <nav aria-label="Цепочка переходов" className="flex min-w-0 flex-1 items-center gap-1 text-xs">
      {visits.length > 1 && (
        <button
          title="Назад к предыдущей карточке"
          aria-label="Назад к предыдущей карточке"
          onClick={() => jump(visits[visits.length - 2]!.url)}
          className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground/5 hover:bg-foreground/10"
        >
          <ArrowLeft className="size-4" />
        </button>
      )}
      {overflow && (
        <button
          aria-label="Предыдущие вкладки"
          className="shrink-0 rounded p-1 hover:bg-foreground/10"
          onClick={() => strip.current?.scrollBy({ left: -240, behavior: "smooth" })}
        >
          <ArrowLeft className="size-3" />
        </button>
      )}
      <div
        ref={strip}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {visits.map((visit, index) => (
          <span key={`${visit.url}:${index}`} className="flex shrink-0 items-center gap-1">
            {index > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
            <button
              aria-current={index === visits.length - 1 ? "page" : undefined}
              title={visit.label}
              onClick={() => jump(visit.url)}
              className={`max-w-44 truncate rounded-md px-2 py-1.5 hover:bg-foreground/10 ${index === visits.length - 1 ? "bg-foreground/10" : "text-muted-foreground"}`}
            >
              {visit.label}
            </button>
          </span>
        ))}
      </div>
      {overflow && (
        <button
          aria-label="Следующие вкладки"
          className="shrink-0 rounded p-1 hover:bg-foreground/10"
          onClick={() => strip.current?.scrollBy({ left: 240, behavior: "smooth" })}
        >
          <ChevronRight className="size-3" />
        </button>
      )}
    </nav>
  );
  return content;
}
