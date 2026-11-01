const key = "golden-return-positions-v1";
const selector =
  "[data-journal-scroll], [data-return-scroll], [role=dialog], .overflow-y-auto, .overflow-x-auto, .overflow-auto";
type Position = {
  x: number;
  y: number;
  panels: { key: string; top: number; left: number }[];
  focus: string | null;
  cursor: number | null;
};
function elements() {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element, index) => ({
    element,
    key:
      element.getAttribute("data-return-scroll") ||
      `${element.getAttribute("data-journal-scroll") || element.getAttribute("aria-label") || element.className}:${index}`,
  }));
}
export function captureReturnPosition(url: string) {
  try {
    const positions = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, Position>;
    const active = document.activeElement as HTMLInputElement | null;
    positions[url] = {
      x: window.scrollX,
      y: window.scrollY,
      panels: elements().map(({ element, key }) => ({
        key,
        top: element.scrollTop,
        left: element.scrollLeft,
      })),
      focus: active?.getAttribute("aria-label") ?? null,
      cursor: active?.selectionStart ?? null,
    };
    const urls = Object.keys(positions);
    while (urls.length > 40) delete positions[urls.shift()!];
    sessionStorage.setItem(key, JSON.stringify(positions));
  } catch {
    /* Optional tab-local view state; never store field values. */
  }
}
export function restoreReturnPosition(url: string) {
  let position: Position | undefined;
  try {
    position = (JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, Position>)[url];
  } catch {
    return () => {};
  }
  if (!position) return () => {};
  const saved = position;
  let stopped = false,
    frame = 0,
    focused = false;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    clearTimeout(timer);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("pointerdown", stop);
    window.removeEventListener("keydown", stop);
  };
  const attempt = () => {
    if (stopped) return;
    window.scrollTo(saved.x, saved.y);
    const current = elements();
    let complete = true;
    for (const panel of saved.panels) {
      const item = current.find((e) => e.key === panel.key);
      if (!item) {
        complete = false;
        continue;
      }
      item.element.scrollTop = panel.top;
      item.element.scrollLeft = panel.left;
      if (
        Math.abs(item.element.scrollTop - panel.top) > 1 ||
        Math.abs(item.element.scrollLeft - panel.left) > 1
      )
        complete = false;
    }
    if (saved.focus && !focused) {
      const field = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[aria-label]"),
      ).find((e) => e.getAttribute("aria-label") === saved.focus);
      if (field) {
        field.focus({ preventScroll: true });
        if (saved.cursor !== null && typeof field.setSelectionRange === "function") {
          try {
            field.setSelectionRange(saved.cursor, saved.cursor);
          } catch {
            /* Numeric/date fields do not expose selection. */
          }
        }
        focused = true;
      }
    }
    if (complete && Math.abs(window.scrollY - saved.y) < 2) stop();
  };
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(attempt);
  });
  const timer = setTimeout(stop, 2500);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("pointerdown", stop, { passive: true });
  window.addEventListener("keydown", stop);
  frame = requestAnimationFrame(attempt);
  return stop;
}
