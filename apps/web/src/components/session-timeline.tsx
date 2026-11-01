"use client";
import {uploadAttachment} from './video-upload';
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, GripVertical, Copy } from "lucide-react";
import {noteDate} from '@/lib/note-date';
import {sessionClipboardWithImages} from '@/lib/session-clipboard';
import { useApi, postJson } from "@/lib/use-api";
import { JournalBodyEditor } from "@/components/journal-body-editor";
import type { SessionEntry } from "@/server/session-entries";
import type { JournalBodyBlock } from "@/server/personal-journal";
export function SessionTimeline({ date,kind='day' }: { date: string;kind?:'day'|'week' }) {
  const api = useApi<{ entries: SessionEntry[] }>(`/api/session-entries?date=${date}&kind=${kind}`);
  const [added, setAdded] = useState<SessionEntry[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState("");
  const [removed,setRemoved]=useState<string[]>([]);
  const [undo,setUndo]=useState<string|null>(null);
  async function archive(id:string,restore=false) {
    try {await postJson('/api/session-entries',{action:restore?'restore':'delete',id});setRemoved(old=>restore?old.filter(x=>x!==id):[...old,id]);setUndo(restore?null:id);}
    catch(cause){setError(cause instanceof Error?cause.message:'Ошибка удаления');}
  }
  const items = [
    ...new Map([...(api.data?.entries ?? []), ...added].map((entry) => [entry.id, entry])).values(),
  ];
  async function create() {
    setBusy(true);
    setError("");
    try {
      const { entry } = await postJson<{ entry: SessionEntry }>("/api/session-entries", {
        action: "create",
        date,
        kind,
      });
      setAdded((old) => [...old, entry]);
      setFocus(entry.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка создания");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {api.error && <p role="alert">{api.error}</p>}
      {items.filter(entry=>!removed.includes(entry.id)).map((entry) => (
        <SessionCard key={entry.id} entry={entry} focus={focus === entry.id} onDelete={()=>archive(entry.id)} />
      ))}
      {undo && <button className="text-sm text-sky-400" onClick={()=>void archive(undo,true)}>Заметка удалена · Отменить</button>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        onClick={create}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
      >
        <Plus className="size-4" />
        {busy ? "Создаём…" : "Внести заметку"}
      </button>
    </div>
  );
}
function SessionCard({ entry, focus, onDelete }: { entry: SessionEntry; focus: boolean; onDelete:()=>Promise<void> }) {
  const [selected,setSelected]=useState(false);
  const [copyMessage,setCopyMessage]=useState('');
  useEffect(()=>{if(!copyMessage)return;const t=setTimeout(()=>setCopyMessage(''),2500);return()=>clearTimeout(t);},[copyMessage]);
  const root = useRef<HTMLDivElement>(null);
  const queue = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState("Сохранено");
  const [retry, setRetry] = useState<JournalBodyBlock[] | null>(null);
  useEffect(() => {
    if (focus) root.current?.querySelector("textarea")?.focus();
  }, [focus]);
  function commit(blocks: JournalBodyBlock[]) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("Сохраняем…");
    localStorage.setItem(`session-draft:${entry.id}`, JSON.stringify(blocks));
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          await postJson("/api/session-entries", { action: "update", id: entry.id, blocks });
          setStatus("Сохранено");
          setRetry(null);
          if (localStorage.getItem(`session-draft:${entry.id}`) === JSON.stringify(blocks))
            localStorage.removeItem(`session-draft:${entry.id}`);
        } catch {
          setStatus("Не сохранено — повторить");
          setRetry(blocks);
        }
      });
  }
  const [initial] = useState(() => {
    try {
      const saved = localStorage.getItem(`session-draft:${entry.id}`);
      return saved ? (JSON.parse(saved) as JournalBodyBlock[]) : entry.blocks;
    } catch {
      return entry.blocks;
    }
  });
  useEffect(() => {
    if (JSON.stringify(initial) !== JSON.stringify(entry.blocks)) commit(initial);
  }, []);
  const currentBlocks=useRef(initial);
  const copiedContent=useRef<{text:string;html:string}|null>(null);
  async function selectCard() {
    try {setCopyMessage('Подготовка…');window.getSelection()?.removeAllRanges();copiedContent.current=await sessionClipboardWithImages(entry.createdAt,currentBlocks.current,window.location.origin,entry.kind==='week');setSelected(true);root.current?.focus();setCopyMessage('Карточка выделена · Ctrl+C');}
    catch{setCopyMessage('Не удалось подготовить скриншоты');}
  }
  async function copyCard() {
    try {const content=await sessionClipboardWithImages(entry.createdAt,currentBlocks.current,window.location.origin,entry.kind==='week');await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([content.text],{type:'text/plain'}),'text/html':new Blob([content.html],{type:'text/html'})})]);setCopyMessage('✓ Скопировано');}
    catch {setCopyMessage('Не удалось скопировать — выдели карточку и нажми Ctrl+C');}
  }
  async function upload(file: File) {
    const form = new FormData();
    form.set("type", "session-entry");
    form.set("id", entry.id);
    form.set("file", file);
    const response = await uploadAttachment(form);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить скриншот");
    return { id: result.id as string, name: file.name };
  }
  return (
    <div ref={root} tabIndex={-1} className={`live-session-note relative rounded-xl border bg-card px-5 py-5 sm:pl-11 sm:pr-7 ${selected?'ring-2 ring-sky-400 bg-sky-500/10':''}`}
      onPointerDownCapture={event=>{if((event.target as HTMLElement).closest('textarea,input,[contenteditable=true]'))setSelected(false);}}
      onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSelected(false);}}
      onKeyDown={event=>{if(event.key==='Escape')setSelected(false);}}
      onCopy={event=>{if(!selected||event.target!==root.current||!copiedContent.current)return;const content=copiedContent.current;event.preventDefault();event.clipboardData.setData('text/plain',content.text);event.clipboardData.setData('text/html',content.html);setCopyMessage('✓ Скопировано');}}
    >
      <button aria-label="Выделить всю Live-заметку" title="Выделить карточку · Ctrl+C — скопировать" className="absolute left-2 top-5 rounded p-1 text-muted-foreground hover:bg-accent" onClick={()=>void selectCard()}><GripVertical className="size-5"/></button>
      <div className="mb-3 flex items-center justify-between border-b border-white/30 pb-3">
        <time
          dateTime={entry.createdAt}
          className="rounded-md bg-white/15 px-2.5 py-1 text-sm font-semibold tabular-nums text-foreground"
        >
          {entry.kind==='week'?noteDate(entry.createdAt):<>{new Intl.DateTimeFormat("ru-RU", {
            timeZone: "Asia/Qyzylorda",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date(entry.createdAt))}
          {" · "}{new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Qyzylorda',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(entry.createdAt))}</>}
        </time>
        <div className="ml-auto flex items-center gap-2 pl-3">
        <span role="status" className="text-sm">{copyMessage}</span>
        <span className="text-[11px] text-muted-foreground" aria-live="polite">
          {retry ? (
            <button onClick={() => commit(retry)} className="text-destructive">
              {status}
            </button>
          ) : (
            status
          )}
        </span>
        <button aria-label={entry.kind==='week'?'Скопировать заметку целиком':'Скопировать Live-заметку целиком'} title="Скопировать заметку" className="rounded p-2 text-muted-foreground hover:bg-accent" onClick={()=>void copyCard()}><Copy className="size-4"/></button>
        <button aria-label={entry.kind==='week'?'Удалить заметку':'Удалить заметку Live Session'} className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive" onClick={async()=>{if(timer.current)clearTimeout(timer.current);await queue.current.catch(()=>{});await onDelete();}}><Trash2 className="size-4"/></button>
        </div>
      </div>
      <JournalBodyEditor
        compact
        workflowUrl={`/journal?review=${entry.kind==='week'?'week':'day'}&date=${entry.dayKey}`}
        workflowLabel={entry.kind==='week'?`Weekly Review · ${entry.dayKey} · Заметки · ${noteDate(entry.createdAt)}`:`Daily Review · ${entry.dayKey} · Live Session · ${new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Qyzylorda", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(entry.createdAt))}`}
        entry={{ id: entry.id, bodyText: "", bodyBlocks: initial }}
        attachments={[]}
        onCommit={blocks=>{currentBlocks.current=blocks;commit(blocks);}}
        onDraft={(blocks) => {
          currentBlocks.current=blocks;
          localStorage.setItem(`session-draft:${entry.id}`, JSON.stringify(blocks));
          setStatus("Сохраняем…");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(blocks), 600);
        }}
        onUpload={upload}
      />
    </div>
  );
}
