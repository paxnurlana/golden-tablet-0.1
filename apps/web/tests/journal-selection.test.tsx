// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JournalBodyEditor } from "../src/components/journal-body-editor";
it("copies and deletes a range containing text, a command and an image without touching adjacent blocks", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); const commit = vi.fn();
  const blocks = [{ id:"before",kind:"text" as const,text:"Keep before" },{ id:"text",kind:"text" as const,text:"Selected\n/идея Test" },{ id:"image",kind:"image" as const,attachmentId:"qa",name:"qa.png" },{ id:"after",kind:"text" as const,text:"Keep after" }];
  try {
    await act(async () => root.render(<JournalBodyEditor entry={{id:"qa",bodyText:"",bodyBlocks:blocks}} attachments={[]} onCommit={commit} onUpload={async()=>undefined}/>));
    const range = document.createRange(); range.setStartBefore(host.querySelector('[data-editor-block="text"]')!); range.setEndAfter(host.querySelector('[data-editor-block="image"]')!);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    const data = new Map<string,string>(); const copy = new Event("copy", {bubbles:true,cancelable:true}); Object.defineProperty(copy,"clipboardData",{value:{setData:(key:string,value:string)=>data.set(key,value)}});
    document.dispatchEvent(copy);
    expect(JSON.parse(data.get("application/x-golden-journal-blocks")!)).toEqual(blocks.slice(1,3));
    expect(data.get("text/html")).toContain('<img');
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true,cancelable:true})));
    expect(commit).toHaveBeenLastCalledWith([blocks[0],blocks[3]]);
  } finally { await act(async()=>root.unmount()); host.remove(); window.getSelection()?.removeAllRanges(); }
});
