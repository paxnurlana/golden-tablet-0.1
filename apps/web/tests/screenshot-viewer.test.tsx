// @vitest-environment jsdom
import { it,expect } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ScreenshotViewer } from "../src/components/screenshot-viewer";
it("opens, zooms, resets and exposes the original download",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const button=(label:string)=>document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  try {
    await act(async()=>root.render(<ScreenshotViewer src="/api/attachments/qa" name="chart.png"/>));
    expect(host.querySelector('a')?.getAttribute('download')).toBe('chart.png');
    await act(async()=>button('Увеличить скриншот').click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async()=>button('Увеличить масштаб').click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('125%');
    await act(async()=>button('Уменьшить масштаб').click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('100%');
    await act(async()=>button('Увеличить масштаб').click());
    await act(async()=>button('Сбросить масштаб').click());
    expect(document.querySelector('[role="dialog"] img')?.getAttribute('style')).toContain('scale(1)');
    await act(async()=>button('Закрыть просмотр').click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  } finally {await act(async()=>root.unmount());host.remove();}
});
