// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/workflow", query: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => state.path,
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ push: state.push }),
}));
import { NavigationTrail } from "../src/components/navigation-trail";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.assign(globalThis, {
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
});
vi.spyOn(window, "scrollTo").mockImplementation(() => {});
Object.assign(globalThis, {
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
});
describe("navigation trail", () => {
  it("returns from a report to the exact Workflow card and survives remount", async () => {
    sessionStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    const page = document.createElement("div");
    page.className = "journal-main";
    page.innerHTML = "<header><h1>Trading Review</h1></header>";
    document.body.append(page);
    const rectangles = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue({ length: 1 } as DOMRectList);
    const root = createRoot(host);
    async function visit(path: string, query: string) {
      state.path = path;
      state.query = query;
      history.replaceState(null, "", path + (query ? "?" + query : ""));
      await act(async () => root.render(<NavigationTrail />));
    }
    await visit("/workflow", "");
    await visit("/workflow", "card=demo-145");
    await visit("/journal", "review=day&date=2026-10-05");
    expect(host.textContent).toContain("Карточка Workflow");
    await act(async () =>
      (
        host.querySelector('[aria-label="Назад к предыдущей карточке"]') as HTMLButtonElement
      ).click(),
    );
    expect(state.push).toHaveBeenCalledWith("/workflow?card=demo-145", { scroll: false });
    await visit("/trades", "");
    await visit("/trades", "entry=trade-123");
    await visit("/catalogs", "kind=type&via=relation");
    expect(host.textContent).toContain("Сделка Journal");
    await act(async () =>
      (
        host.querySelector('[aria-label="Назад к предыдущей карточке"]') as HTMLButtonElement
      ).click(),
    );
    expect(state.push).toHaveBeenLastCalledWith("/trades?entry=trade-123", { scroll: false });
    await visit("/catalogs", "kind=type");
    expect(host.textContent).not.toContain("Сделка Journal");
    await visit("/playbooks", "");
    const internal = document.createElement("a");
    internal.href = "/accounts";
    internal.onclick = (e) => e.preventDefault();
    document.body.append(internal);
    await act(async () => internal.click());
    await visit("/accounts", "");
    expect(host.textContent).toContain("Playbooks");
    await act(async () =>
      (
        host.querySelector('[aria-label="Назад к предыдущей карточке"]') as HTMLButtonElement
      ).click(),
    );
    expect(state.push).toHaveBeenLastCalledWith("/playbooks", { scroll: false });
    internal.className = "journal-sidebar-nav-link";
    internal.href = "/workflow";
    await act(async () => internal.click());
    await visit("/workflow", "");
    expect(host.textContent).not.toContain("Playbooks");
    internal.remove();
    await visit("/workflow", "card=demo-145");
    await visit("/workflow", "card=demo-145");
    expect(host.textContent).not.toContain("День ·");
    await act(async () => root.unmount());
    const second = createRoot(host);
    await act(async () => second.render(<NavigationTrail />));
    expect(host.textContent).toContain("Карточка Workflow");
    await act(async () => second.unmount());
    host.remove();
    page.remove();
    rectangles.mockRestore();
  });
});
