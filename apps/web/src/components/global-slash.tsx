"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {slashMenuPosition} from '@/lib/slash-menu-position';
import {normalizeWorkflowSource} from '@/lib/workflow-source';
import {SaveAlert} from './save-alert';
import {activeEditorField,caretRect,focusEditorOffset} from '@/lib/editor-caret';
import { postJson } from "@/lib/use-api";
import { WORKFLOW_CATEGORIES, WORKFLOW_COLORS, workflowCommands } from "@/lib/workflow";
type TextControl = HTMLTextAreaElement | HTMLInputElement;
type Menu = {
  anchor: TextControl;
  target: TextControl;
  start: number;
  end: number;
  query: string;
  left: number;
  top: number;
};
export function GlobalSlash() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const retrySave=useRef<()=>void>(()=>{});
  const menuElement=useRef<HTMLDivElement|null>(null);
  const [position,setPosition]=useState<ReturnType<typeof slashMenuPosition>|null>(null);
  const current = useRef<Menu | null>(null);
  current.current = menu;
  const options = WORKFLOW_CATEGORIES.filter((category) => category.includes(menu?.query ?? ""));
  if (menu?.query && !options.includes(menu.query)) options.push(menu.query);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useLayoutEffect(()=>{
    if(!menu){setPosition(null);return;}
    const update=()=>{
      const field=menu.anchor.isConnected?menu.anchor:activeEditorField(menu.target);
      setPosition(slashMenuPosition(caretRect(field),{width:innerWidth,height:innerHeight},menuElement.current?.scrollHeight??360));
    };
    update();window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
  },[menu,options.length]);
  useEffect(()=>{const menu=menuElement.current,option=menu?.querySelector<HTMLElement>('[aria-selected="true"]');if(menu&&option){const top=option.offsetTop,bottom=top+option.offsetHeight;if(top<menu.scrollTop)menu.scrollTop=top;else if(bottom>menu.scrollTop+menu.clientHeight)menu.scrollTop=bottom-menu.clientHeight;}},[active]);
  function choose(category: string) {
    const m = current.current;
    if (!m) return;
    const before = m.target.value.slice(0, m.start);
    const separator = before && !before.endsWith("\n") ? "\n" : "";
    const text = before + separator + `/${category} ` + m.target.value.slice(m.end);
    const proto =
      m.target instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(m.target, text);
    m.target.dispatchEvent(new Event("input", { bubbles: true }));
    m.target.setSelectionRange(
      m.start + separator.length + category.length + 2,
      m.start + separator.length + category.length + 2,
    );
    requestAnimationFrame(()=>focusEditorOffset(m.target,m.start+separator.length+category.length+2));
    setMenu(null);
  }
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const queues = new Map<string, Promise<unknown>>();
    const eligible = (target: EventTarget | null): target is TextControl =>
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement &&
        ["text", ""].includes(target.type) &&
        target.getAttribute("role") !== "combobox" &&
        !/Поиск|Search/i.test(target.getAttribute("aria-label") ?? target.placeholder));
    const payload = (target: TextControl) => {
      const url =
        target.closest("[data-workflow-url]")?.getAttribute("data-workflow-url") ??
        location.pathname + location.search;
      const label =
        target.closest("[data-workflow-label]")?.getAttribute("data-workflow-label") ||
        target.getAttribute("aria-label") ||
        target.getAttribute("data-workflow-field-label") ||
        target.labels?.[0]?.textContent?.trim().slice(0, 180) ||
        target.placeholder ||
        "Заметка";
      const owner =
        target.getAttribute("data-workflow-source") ||
        target.closest("[data-workflow-owner]")?.getAttribute("data-workflow-owner");
      const field = target.name || target.id || target.getAttribute("data-block-id") || label;
      const fallback = [...document.querySelectorAll("textarea,input[type=text]")].indexOf(target);
      return normalizeWorkflowSource({
        source: target.getAttribute('data-workflow-source') || (owner ? `${owner}:${field}` : `${url}:${field}:${fallback}`),
        url,
        label: label.slice(0, 300),
        text: target.value,
      }) as {source:string;url:string;label:string;text:string};
    };
    const failures=new Map<string,string>();
    const save = (raw: ReturnType<typeof payload>) => {
      const data=normalizeWorkflowSource(raw) as ReturnType<typeof payload>;
      localStorage.setItem(`workflow-pending:${data.source}`, JSON.stringify(data));
      if(raw.source!==data.source)localStorage.removeItem(`workflow-pending:${raw.source}`);
      const previous = queues.get(data.source) ?? Promise.resolve();
      const next = previous
        .catch(() => {})
        .then(() => postJson("/api/workflow", data))
        .then(() => {
          if (localStorage.getItem(`workflow-pending:${data.source}`) === JSON.stringify(data))
            localStorage.removeItem(`workflow-pending:${data.source}`);
          failures.delete(data.source);setError([...failures.values()][0]??'');
          window.dispatchEvent(new Event("workflow-updated"));
        })
        .catch(cause=>{failures.set(data.source,cause instanceof Error?cause.message:'Не удалось связаться с сервером.');setError([...failures.values()][0]!);});
      queues.set(data.source, next);
    };
    const input = (event: Event) => {
      if (!eligible(event.target) || event.target.closest("[data-no-slash]")) return;
      const target = event.target;
      const position = target.selectionStart ?? target.value.length;
      const before = target.value.slice(0, position);
      const match = before.match(/(?:^|\s)\/([\p{L}\p{N}_-]{0,40})$/u);
      if (match && !target.readOnly) {
        const rect = caretRect(activeEditorField(target));
        setMenu({
          anchor:activeEditorField(target),
          target,
          start: position - match[1]!.length - 1,
          end: position,
          query: match[1]!.toLowerCase(),
          left: Math.max(8, Math.min(rect.left, innerWidth - 260)),
          top: Math.max(8, Math.min(rect.bottom + 4, innerHeight - 240)),
        });
        setActive(0);
      } else setMenu(null);
      const data = payload(target);
      target.classList.toggle("workflow-command-editor", workflowCommands(data.text).length > 0);
      if (
        workflowCommands(data.text).length ||
        localStorage.getItem(`workflow-known:${data.source}`)
      ) {
        localStorage.setItem(`workflow-known:${data.source}`, "1");
        localStorage.setItem(`workflow-pending:${data.source}`, JSON.stringify(data));
        clearTimeout(timers.get(data.source));
        timers.set(
          data.source,
          setTimeout(() => {
            timers.delete(data.source);
            save(data);
          }, 650),
        );
      }
    };
    const keys = (event: KeyboardEvent) => {
      if (!current.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(null);
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActive(
          (i) =>
            (i + (event.key === "ArrowDown" ? 1 : -1) + optionsRef.current.length) %
            Math.max(1, optionsRef.current.length),
        );
      }
      if (event.key === "Enter" && optionsRef.current.length) {
        event.preventDefault();
        chooseRef.current(optionsRef.current[activeRef.current] ?? optionsRef.current[0]!);
      }
    };
    const retry = () => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("workflow-pending:"))
        .forEach((key) => {
          try {
            save(JSON.parse(localStorage.getItem(key)!));
          } catch {}
        });
    };
    retrySave.current=retry;
    let revealed = "";
    const revealSource = () => {
      if (!location.hash.startsWith("#workflow=") || revealed === location.href) return;
      let source = "";
      try {
        source = decodeURIComponent(location.hash.slice(10));
      } catch {
        return;
      }
      const target = [...document.querySelectorAll("textarea,input[type=text]")].find(
        (element) => eligible(element) && payload(element).source === source,
      ) as TextControl | undefined;
      if (target) {
        revealed = location.href;
        target.scrollIntoView({ block: "center" });
        const proxy =
          target.style.display === "none"
            ? target.previousElementSibling?.querySelector<HTMLTextAreaElement>("textarea")
            : null;
        (proxy || target).scrollIntoView({ block: "center" });
        (proxy || target).focus({ preventScroll: true });
      }
    };
    const observer = new MutationObserver(revealSource);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", revealSource);
    revealSource();
    const outside = (event: PointerEvent) => {
      if (
        current.current &&
        event.target instanceof Element &&
        !event.target.closest('[aria-label="Slash команды"]') &&
        event.target !== current.current.target
      )
        setMenu(null);
    };
    document.addEventListener("input", input);
    document.addEventListener("keydown", keys, true);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("online", retry);
    retry();
    return () => {
      document.removeEventListener("input", input);
      document.removeEventListener("keydown", keys, true);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("online", retry);
      timers.forEach(clearTimeout);
      observer.disconnect();
      window.removeEventListener("hashchange", revealSource);
    };
  }, []);
  const activeRef = useRef(active);
  activeRef.current = active;
  return (
    <>
      {menu && (
        <div
          ref={menuElement}
          role="listbox"
          aria-label="Slash команды"
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border bg-popover p-2 shadow-xl"
          style={position??{left:menu.left,top:menu.top,width:240,maxHeight:0,visibility:'hidden'}}
          onWheel={event=>event.stopPropagation()}
        >
          <div className="px-2 py-1 text-xs text-muted-foreground">Создать в Workflow</div>
          {options.map((category, i) => (
            <button
              key={category}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(category)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm capitalize ${i === active ? "bg-accent" : ""}`}
              style={{ color: WORKFLOW_COLORS[category] }}
            >
              /{category}
            </button>
          ))}
        </div>
      )}
      {error && (
        <SaveAlert message={error} onRetry={()=>retrySave.current()}/>
      )}
    </>
  );
}
