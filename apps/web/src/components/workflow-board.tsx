"use client";
import {uploadAttachment} from './video-upload';
import { SlashTextarea } from "@/components/slash-textarea";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Plus,
  X,
  Circle,
  CircleDot,
  CircleCheck,
  ListTodo,
  Lightbulb,
  MessageSquare,
  CircleHelp,
  FlaskConical,
  Scale,
  BookOpen,
  Copy,
  Trash2,
} from "lucide-react";
import { useApi, postJson } from "@/lib/use-api";
import {
  WORKFLOW_CATEGORIES,
  WORKFLOW_LABELS,
  WORKFLOW_COLORS,
  sortWorkflowCards,
  type WorkflowSort,
  workflowSourceLabel,
  type WorkflowCard,
} from "@/lib/workflow";
import { JournalBodyEditor } from "./journal-body-editor";
import {AttachmentMedia} from './attachment-media';
import type { JournalBodyBlock } from "@/server/personal-journal";
import { resizeTextarea } from "@/lib/textarea-height";
import {workflowDate,workflowStatusAge} from '@/lib/workflow-dates';
const labels = WORKFLOW_LABELS;
const typeIcons: Record<string, typeof Lightbulb> = {
  задача: ListTodo,
  идея: Lightbulb,
  мысль: MessageSquare,
  вопрос: CircleHelp,
  research: FlaskConical,
  playbook: BookOpen,
  закон: Scale,
};
function StatusIcon({ status }: { status: string }) {
  return status === "done" ? (
    <CircleCheck className="size-4 text-emerald-400" />
  ) : status === "doing" ? (
    <CircleDot className="size-4 text-blue-400" />
  ) : (
    <Circle className="size-4 text-muted-foreground" />
  );
}
export function WorkflowBoard() {
  const router = useRouter();
  const search = useSearchParams();
  const api = useApi<{ cards: WorkflowCard[] }>("/api/workflow");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<WorkflowSort>("oldest");
  const pan = useRef<{pointer:number;x:number;left:number} | null>(null);
  const [panning, setPanning] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem("workflow-sort"); if (["oldest", "newest", "updated", "name"].includes(saved ?? "")) setSort(saved as WorkflowSort); } catch {}
  }, []);
  const [selected, setSelected] = useState<WorkflowCard | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const draggedCard=useRef<string|null>(null);
  const lastDrag=useRef(0);
  const [dropCategory,setDropCategory]=useState<string|null>(null);
  const [moving,setMoving]=useState(false);
  async function moveCategory(id:string,category:string){
    if(moving)return;
    setMoving(true);setError('');
    try{await postJson('/api/workflow',{action:'category',id,category});api.refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось перенести карточку');}finally{setMoving(false);draggedCard.current=null;setDropCategory(null);}
  }
  const cards = api.data?.cards ?? [];
  useEffect(() => {
    const id = search.get("card");
    if (id) {
      const found = cards.find((card) => card.id === id);
      if (found) {
        setSelected(found);
      }
    } else setSelected(null);
  }, [api.data, search]);
  const categories = [...new Set([...WORKFLOW_CATEGORIES, ...cards.map((card) => card.category)])];
  const categoryView=search.get('category');
  const focusedCategory=categoryView&&categories.includes(categoryView)?categoryView:null;
  function workflowUrl(id?:string){const params=new URLSearchParams();if(focusedCategory)params.set('category',focusedCategory);if(id)params.set('card',id);return `/workflow${params.size?'?'+params:''}`;}
  const [cardAction,setCardAction]=useState<string|null>(null);
  async function quickAction(card:WorkflowCard,action:'duplicate'|'delete'){
    if(cardAction)return;setCardAction(card.id);setError('');
    try{await postJson('/api/workflow',{action,id:card.id});if(action==='delete')setDeletedId(card.id);api.refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие');}finally{setCardAction(null);}
  }
  async function create(category: string) {
    if (creating) return;
    setCreating(true);
    try {
      const result = await postJson<{ id: string }>("/api/workflow", {
        action: "create",
        text: "",
        category,
        status: filter || "inbox",
      });
      setSelected({
        id: result.id,
        source: `manual:${result.id}`,
        url: "/workflow",
        label: "Создано в Workflow",
        slot: 0,
        text: "",
        category,
        status: (filter || "inbox") as WorkflowCard["status"],
        detached: false,
        blocks: [],
      });
      api.refresh();
      window.history.pushState(null, "", workflowUrl(result.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  }
  return (
    <main className="flex h-[calc(100dvh-7rem)] min-w-0 flex-col overflow-hidden px-5 pt-5 pb-3 sm:px-8 sm:pt-8 lg:h-[calc(100dvh-3.5rem)]">
      <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="sr-only">Workflow</h1>
        <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Статус</span>
        <div role="group" aria-label="Статус записей Workflow" className="flex gap-1 rounded-lg bg-muted/40 p-1">
          {[
            ["", "Все"],
            ["inbox", "Входящие"],
            ["doing", "В работе"],
            ["done", "Завершено"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter===value}
              onClick={() => setFilter(value!)}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === value ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          По дате создания
          <select aria-label="Сортировка Workflow" value={sort} className="rounded-lg border bg-muted px-3 py-2 text-foreground"
            onChange={event => { const value = event.target.value as WorkflowSort; setSort(value); try { localStorage.setItem("workflow-sort", value); } catch {} }}>
            <option value="oldest">Сначала старые</option>
            <option value="newest">Сначала новые</option>
            <option value="updated">Недавно изменённые</option>
            <option value="name">По названию</option>
          </select>
        </label>
      </div>
      {focusedCategory&&<div className="mb-4 flex shrink-0 items-center gap-3"><button className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent" onClick={()=>router.push('/workflow')}>← Все категории</button><h2 className="text-lg font-semibold" style={{color:WORKFLOW_COLORS[focusedCategory]}}>{labels[focusedCategory]||focusedCategory}</h2></div>}
      {(api.error || error) && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {api.error || error}
        </p>
      )}
      {deletedId && <div role="status" className="mb-4 flex items-center gap-3 text-sm">Карточка удалена<button className="text-sky-400" onClick={async()=>{try{await postJson('/api/workflow',{action:'restore',id:deletedId});setDeletedId(null);api.refresh();}catch{setError('Не удалось восстановить карточку');}}}>Отменить</button></div>}
      <div
        aria-label="Доска Workflow"
        className={`flex min-h-0 flex-1 items-start gap-4 overflow-auto overscroll-contain pb-5 ${panning ? "cursor-grabbing select-none" : "cursor-grab"}`}
        onPointerDown={event => {
          if (focusedCategory || event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest('button,a,input,textarea,select,[data-workflow-card],[contenteditable="true"]')) return;
          pan.current={pointer:event.pointerId,x:event.clientX,left:event.currentTarget.scrollLeft};
          event.currentTarget.setPointerCapture(event.pointerId);
          setPanning(true);
          event.preventDefault();
        }}
        onPointerMove={event => {
          const start=pan.current;
          if (start && start.pointer===event.pointerId) event.currentTarget.scrollLeft=start.left-(event.clientX-start.x);
        }}
        onPointerUp={event => {
          pan.current=null;
          setPanning(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {pan.current=null;setPanning(false);}}
        onLostPointerCapture={() => {pan.current=null;setPanning(false);}}
      >
        {(focusedCategory?[focusedCategory]:categories).map((category) => {
          const TypeIcon = typeIcons[category] || MessageSquare;
          const visible = sortWorkflowCards(cards.filter(
            (card) => card.category === category && (!filter || card.status === filter),
          ), sort);
          return (
            <section key={category} aria-label={`Столбец ${labels[category] || category}`} className={`${focusedCategory?'w-full':'w-72 shrink-0'} rounded-xl bg-muted p-3 transition-shadow ${dropCategory===category?'ring-2 ring-sky-400 bg-sky-500/10':''}`}
              onDragOver={event=>{if(!draggedCard.current)return;event.preventDefault();event.dataTransfer.dropEffect='move';setDropCategory(category);}}
              onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropCategory(null);}}
              onDrop={event=>{if(!draggedCard.current)return;event.preventDefault();event.stopPropagation();void moveCategory(draggedCard.current,category);}}
            >
              <div className="mb-3 flex items-center gap-2">
                <button type="button" aria-label={`Открыть категорию: ${labels[category]||category}`} onClick={()=>router.push(`/workflow?category=${encodeURIComponent(category)}`)} style={{ color: WORKFLOW_COLORS[category], backgroundColor: `${WORKFLOW_COLORS[category] || "#a1a1aa"}18` }} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold hover:brightness-125">
                  <TypeIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  {labels[category] || category}
                </button>
                <span className="text-xs text-muted-foreground">{visible.length}</span>
              </div>
              <div className={focusedCategory?'grid items-stretch gap-3 lg:grid-cols-2 2xl:grid-cols-3':'space-y-2'}>
                {visible.map((card) => (
                  <div
                    key={card.id}
                    data-workflow-card={card.id}
                    draggable={!moving}
                    onDragStart={event=>{draggedCard.current=card.id;event.dataTransfer.setData('application/x-golden-workflow-card',card.id);event.dataTransfer.effectAllowed='move';}}
                    onDragEnd={()=>{lastDrag.current=Date.now();draggedCard.current=null;setDropCategory(null);}}
                    className="group relative flex w-full cursor-grab flex-col rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-foreground/20 active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-1">
                  <button
                    onClick={() => {
                      if(draggedCard.current||Date.now()-lastDrag.current<250)return;
                      setSelected(card);
                      window.history.pushState(null, "", workflowUrl(card.id));
                    }}
                    className="flex min-w-0 flex-1 cursor-inherit items-start gap-2.5 rounded-md text-left"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                      <StatusIcon status={card.status} />
                    </span>
                    <span className={`${focusedCategory?'line-clamp-12 whitespace-pre-wrap':'line-clamp-5'} break-words text-sm font-normal leading-6`}>
                      {card.text || <span className="text-muted-foreground">Новая запись</span>}
                    </span>
                  </button>
                  </div>
                  {focusedCategory&&card.blocks?.some(block=>block.kind==='text'&&block.text.trim())&&<p className="mt-2 line-clamp-6 whitespace-pre-wrap break-words pl-7 text-xs leading-5 text-muted-foreground">{card.blocks.filter(block=>block.kind==='text').map(block=>block.kind==='text'?block.text:'').join('\n').replace(/\[\[image:[a-zA-Z0-9_-]+\]\]/g,'')}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 pl-7 text-[10px] font-normal leading-4 text-muted-foreground">
                    <time dateTime={card.created_at} title={`Создана: ${workflowDate(card.created_at,true)}`}>{workflowDate(card.created_at)}</time>
                    {focusedCategory&&<span className="flex items-center gap-1">
                      <span title={workflowDate(card.status_changed_at,true)}>{workflowStatusAge(card.status_changed_at)}</span>
                      <button disabled={!!cardAction} type="button" title="Копировать карточку" aria-label={`Копировать: ${card.text||'Новая запись'}`} className="rounded p-1.5 hover:bg-accent" onClick={()=>void quickAction(card,'duplicate')}><Copy className="size-3.5"/></button>
                      <button disabled={!!cardAction} type="button" title="Удалить карточку" aria-label={`Удалить: ${card.text||'Новая запись'}`} className="rounded p-1.5 hover:bg-accent hover:text-destructive" onClick={()=>void quickAction(card,'delete')}><Trash2 className="size-3.5"/></button>
                    </span>}
                  </div>
                  </div>
                ))}
                {api.loading && !visible.length && (
                  <p className="px-1 py-4 text-xs text-muted-foreground">
                    {api.loading ? "Загрузка…" : "Пока пусто"}
                  </p>
                )}
                <button type="button" disabled={creating} aria-label={`Создать новую запись: ${labels[category]||category}`} onClick={()=>void create(category)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border border-border/40 bg-foreground/[0.025] px-4 text-sm font-normal text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50 ${focusedCategory?'min-h-28 self-stretch':'min-h-14'}`}>
                  <Plus aria-hidden="true" className="size-4"/>Новая запись
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <Dialog.Root
        modal={false}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            window.history.pushState(null, "", workflowUrl());
            api.refresh();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed bottom-0 top-28 lg:top-14 right-0 z-50 w-full overflow-y-auto border-l bg-background shadow-2xl sm:w-[min(900px,85vw)]"
            onInteractOutside={(event) => {
              if (
                (event.target as HTMLElement).closest(
                  ".journal-mobile-header, .journal-context-bar",
                )
              )
                event.preventDefault();
            }}
          >
            <div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-background/95 px-5 backdrop-blur">
              <span className="text-sm text-muted-foreground">
                Workflow / {selected && (labels[selected.category] || selected.category)}
              </span>
              <Dialog.Close
                aria-label="Закрыть карточку"
                className="rounded-lg p-2 hover:bg-accent"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <Dialog.Title className="sr-only">Карточка Workflow</Dialog.Title>
            {selected && <WorkflowEditor key={selected.id} card={selected} refresh={api.refresh}
              onDeleted={()=>{setDeletedId(selected.id);setSelected(null);window.history.pushState(null,'',workflowUrl());api.refresh();}}
              onDuplicated={id=>{setSelected(null);window.history.pushState(null,'',workflowUrl(id));api.refresh();}}
            />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
function WorkflowEditor({ card, refresh, onDeleted, onDuplicated }: { card: WorkflowCard; refresh: () => void; onDeleted:()=>void; onDuplicated:(id:string)=>void }) {
  const recovered = useRef<Record<string, unknown> | null>(null);
  if (recovered.current === null) {
    try {
      recovered.current = JSON.parse(localStorage.getItem(`workflow-detail:${card.id}`) || "{}");
    } catch {
      recovered.current = {};
    }
  }
  const [title, setTitle] = useState(String(recovered.current?.text ?? card.text));
  const [status, setStatus] = useState(card.status);
  const [hint, setHint] = useState("Сохранено");
  const initial = (recovered.current?.blocks as JournalBodyBlock[] | undefined) ?? card.blocks;
  const latest = useRef<JournalBodyBlock[]>(
    initial?.length ? initial : [{ id: `text-${card.id}`, kind: "text", text: "" }],
  );
  const [acting, setActing] = useState(false);
  const removed = useRef(false);
  const heading = useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const element=heading.current;if(!element)return;const resize=()=>resizeTextarea(element,32);resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();},[title]);
  const titleRef = useRef(title);
  titleRef.current = title;
  const queue = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function save(blocks: JournalBodyBlock[], nextTitle?: string) {
    latest.current = blocks;
    const snapshot = {
      action: "update",
      id: card.id,
      blocks,
      text: nextTitle ?? titleRef.current,
    };
    localStorage.setItem(`workflow-detail:${card.id}`, JSON.stringify(snapshot));
    setHint("Сохраняем…");
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          await postJson("/api/workflow", snapshot);
          if (localStorage.getItem(`workflow-detail:${card.id}`) === JSON.stringify(snapshot))
            localStorage.removeItem(`workflow-detail:${card.id}`);
          setHint("Сохранено");
          refresh();
        } catch {
          setHint("Не сохранено — черновик остался на устройстве");
        }
      });
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (!removed.current) save(latest.current);
    },
    [],
  );
  async function act(action: "delete" | "duplicate") {
    if (acting) return;
    setActing(true);
    try {
      if (timer.current) clearTimeout(timer.current);
      await queue.current;
      await postJson('/api/workflow',{action:'update',id:card.id,blocks:latest.current,text:titleRef.current});
      const result=await postJson<{id:string}>('/api/workflow',{action,id:card.id});
      localStorage.removeItem(`workflow-detail:${card.id}`);
      removed.current=true;
      if(action==='delete')onDeleted();else onDuplicated(result.id);
    } catch(e) {setHint(e instanceof Error?e.message:'Не удалось выполнить действие');setActing(false);}
  }
  async function upload(file: File) {
    const form = new FormData();
    form.set("type", "workflow");
    form.set("id", card.id);
    form.set("file", file);
    const response = await uploadAttachment(form);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return { id: result.id, name: file.name };
  }
  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-10">
      <div className="mb-5 flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-foreground/5">
          <StatusIcon status={status} />
        </span>
        <select aria-label="Статус карточки" value={status} className="ml-3 rounded-lg border bg-background px-3 py-2 text-sm" onChange={async e=>{const value=e.target.value as WorkflowCard['status'];try{await postJson('/api/workflow',{action:'move',id:card.id,status:value});setStatus(value);refresh();}catch{setHint('Не удалось сохранить статус');}}}>
          <option value="inbox">Входящие</option><option value="doing">В работе</option><option value="done">Завершено</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {hint}
        </span>
        <button disabled={acting} aria-label="Дублировать карточку" title="Дублировать" className="rounded p-2 hover:bg-accent" onClick={()=>void act('duplicate')}><Copy className="size-4"/></button>
        <button disabled={acting} aria-label="Удалить карточку" title="Удалить" className="rounded p-2 hover:bg-accent hover:text-destructive" onClick={()=>void act('delete')}><Trash2 className="size-4"/></button>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>Создана: <time dateTime={card.created_at}>{workflowDate(card.created_at,true)}</time></span>
        <span>{card.status_changed_at ? <>Статус изменён: <time dateTime={card.status_changed_at}>{workflowDate(card.status_changed_at,true)}</time> · {workflowStatusAge(card.status_changed_at)}</> : 'История смены статуса для этой старой карточки не велась'}</span>
      </div>
      <SlashTextarea
        ref={heading}
        data-no-slash
        aria-label="Название карточки"
        placeholder="Новая запись"
        rows={1}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          localStorage.setItem(
            `workflow-detail:${card.id}`,
            JSON.stringify({ blocks: latest.current, text: e.target.value }),
          );
          if (timer.current) clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => save(latest.current, value), 600);
        }}
        onBlur={() => {
          save(latest.current, title);
        }}
        className="w-full resize-none overflow-hidden bg-transparent text-xl font-semibold leading-snug outline-none placeholder:text-muted-foreground focus:placeholder:text-transparent sm:text-2xl"
      />
      <div className="my-6 flex flex-wrap items-center gap-3 text-sm">
        <select aria-label="Тип карточки Workflow" value={card.category} disabled={acting} className="rounded-lg border bg-background px-3 py-2"
          onChange={async event=>{const category=event.target.value;try{await postJson('/api/workflow',{action:'category',id:card.id,category});refresh();}catch{setHint('Не удалось изменить тип карточки');}}}>
          {[...new Set([...WORKFLOW_CATEGORIES,card.category])].map(category=><option key={category} value={category}>{labels[category] || category}</option>)}
        </select>
      </div>
      {card.detached && (
        <p className="mt-3 text-xs text-muted-foreground">Слеш-команды больше нет в источнике. Карточка сохранена и доступна для редактирования.</p>
      )}
      <div className="mt-8">
        {!!card.sourceImages?.length && <div className="mb-6 space-y-3">
          {card.sourceImages.map(image => <div key={image.id} className="relative overflow-hidden rounded-lg border"><AttachmentMedia src={`/api/attachments/${image.id}`} name={image.name}/></div>)}
        </div>}
        <JournalBodyEditor
          workflowUrl={`/workflow?card=${card.id}`}
          workflowLabel={`Workflow · ${labels[card.category] || card.category} · ${card.text.slice(0, 180)}`}
          compact
          entry={{ id: card.id, bodyText: "", bodyBlocks: latest.current }}
          attachments={[]}
          onCommit={(blocks) => save(blocks)}
          onDraft={(blocks) => {
            latest.current = blocks;
            localStorage.setItem(
              `workflow-detail:${card.id}`,
              JSON.stringify({ blocks, text: titleRef.current }),
            );
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => save(blocks), 600);
          }}
          onUpload={upload}
        />
      </div>
      {!card.source.startsWith("manual:") && (
        <Link
          href={`${card.url}#workflow=${encodeURIComponent(card.source)}`}
          className="mt-8 block text-sm text-muted-foreground hover:text-foreground"
        >
          Запись создана в: ↗ {workflowSourceLabel(card)}
        </Link>
      )}
    </div>
  );
}
