// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobalSlash } from "../src/components/global-slash";
import { SlashTextarea } from "../src/components/slash-textarea";
const post = vi.hoisted(() => vi.fn(async (_url: string, _data: unknown) => ({ ok: true })));
vi.mock("@/lib/use-api", () => ({ postJson: post }));
function Fixture() {
  const [value, setValue] = useState("");
  return (
    <>
      <GlobalSlash />
      <SlashTextarea
        aria-label="План"
        data-workflow-source="qa:test"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </>
  );
}

it('opens slash commands after a review screenshot at the current visible caret',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 Element.prototype.scrollIntoView=vi.fn();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<><GlobalSlash/><SlashTextarea aria-label="Итоги и выводы" data-workflow-source="review:day:2026-10-16:postText" defaultValue={'Conclusion\n[[image:test-shot]]'}/></>));
  const field=host.querySelector<HTMLTextAreaElement>('textarea[aria-label*="после скриншота"]')!;
  await act(async()=>{
   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'/');field.setSelectionRange(1,1);field.dispatchEvent(new Event('input',{bubbles:true}));
  });
  expect(document.body.textContent).toContain('Создать в Workflow');
  const source=host.querySelector<HTMLTextAreaElement>('textarea[data-workflow-source]')!;
  expect(source.value).toContain('[[image:test-shot]]\n/');expect(source.selectionStart).toBe(source.value.length);
 }finally{await act(async()=>root.unmount());host.remove();}
});
afterEach(() => {
  localStorage.clear();
  post.mockClear();
  vi.useRealTimers();
});
it("changes a slash block category without losing text and removes only that block", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<SlashTextarea defaultValue={"Above\n/мысль Keep me\nBelow"} />));
    const click = async (label: string) => act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
    await click("Изменить тип /мысль");
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(b => b.textContent === "/идея")!.click());
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Текст /идея"]')!.value).toBe("Keep me");
    await click("Удалить блок /идея");
    expect(host.querySelector('textarea[aria-label="Текст /идея"]')).toBeNull();
    expect([...host.querySelectorAll<HTMLTextAreaElement>('[data-slash-blocks] textarea')].map(e => e.value).join("\n")).toBe("Above\nBelow");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
it("preserves title typography in the visible editor",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<SlashTextarea aria-label="Заголовок" defaultValue="Title" style={{fontSize:'20px',fontWeight:700,lineHeight:'27.5px'}}/>));
    const visible=host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!;
    expect(getComputedStyle(visible).fontSize).toBe('20px');expect(getComputedStyle(visible).fontWeight).toBe('700');
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('updates the visible readOnly flag while an upload is pending',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<SlashTextarea defaultValue="text" readOnly={false}/>));
    await act(async()=>root.render(<SlashTextarea defaultValue="text" readOnly/>));
    expect(host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!.readOnly).toBe(true);
    await act(async()=>root.render(<SlashTextarea defaultValue="text" readOnly={false}/>));
    expect(host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!.readOnly).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();}
});
it("opens the global menu, inserts the chosen command into controlled text and syncs one source", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Fixture />));
    const text = host.querySelector<HTMLTextAreaElement>("textarea[data-workflow-source]")!;
    const write = (value: string) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        text,
        value,
      );
      text.setSelectionRange(value.length, value.length);
      text.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => write("/"));
    expect(host.querySelector("[role=listbox]")).not.toBeNull();
    await act(async () =>
      [...host.querySelectorAll<HTMLButtonElement>("button")]
        .find((b) => b.textContent === "/идея")!
        .click(),
    );
    expect(text.value).toBe("/идея ");
    await act(async () => write("/идея Проверить VAH"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(post).toHaveBeenCalledWith(
      "/api/workflow",
      expect.objectContaining({ source: "qa:test", text: "/идея Проверить VAH" }),
    );
    expect(localStorage.getItem("workflow-pending:qa:test:План")).toBeNull();
    await act(async () => write("/идея Проверить VAL"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(post.mock.calls.at(-1)?.[1]).toMatchObject({
      source: "qa:test",
      text: "/идея Проверить VAL",
    });
    const block = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Текст /идея"]')!;
    expect(block.value).toBe("Проверить VAL");
    expect(block.parentElement?.style.borderColor).toBe("rgb(96, 165, 250)");
    await act(async () =>
      block.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(text.value).toBe("/идея Проверить VAL\n");
    expect(host.querySelectorAll("[data-slash-blocks] textarea").length).toBe(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
