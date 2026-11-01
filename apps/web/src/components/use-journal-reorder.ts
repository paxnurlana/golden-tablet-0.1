"use client";
import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
  type PointerEvent,
} from "react";

export function useJournalReorder<T extends string>(
  setOrder: Dispatch<SetStateAction<T[]>>,
  container: RefObject<HTMLElement | null>,
  attribute: string,
  axis: "x" | "y",
) {
  const [dragged, setDragged] = useState<T | null>(null);
  const [target, setTarget] = useState<{ id: T; edge: "before" | "after" } | null>(null);
  const start = useRef<{
    id: T;
    point: number;
    active: boolean;
    target: { id: T; edge: "before" | "after" } | null;
  } | null>(null);
  const cancel = () => {
    start.current = null;
    setDragged(null);
    setTarget(null);
  };
  const point = (event: PointerEvent<HTMLElement>) =>
    axis === "x" ? event.clientX : event.clientY;
  const bind = (id: T) => ({
    draggable: false,
    onDragStart: (event: { preventDefault: () => void }) => event.preventDefault(),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      start.current = { id, point: point(event), active: false, target: null };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = start.current;
      if (!current || current.id !== id) return;
      if (!current.active && Math.abs(point(event) - current.point) < 4) return;
      current.active = true;
      setDragged(id);
      const scroll = container.current?.closest<HTMLElement>("[data-journal-scroll]");
      if (scroll) {
        const bounds = scroll.getBoundingClientRect();
        const value = point(event),
          lower = axis === "x" ? bounds.left : bounds.top,
          upper = axis === "x" ? bounds.right : bounds.bottom;
        const shift = value < lower + 24 ? -12 : value > upper - 24 ? 12 : 0;
        if (shift) scroll.scrollBy(axis === "x" ? { left: shift } : { top: shift });
      }
      const nodes = Array.from(
        container.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? [],
      );
      let best: HTMLElement | undefined;
      let distance = Infinity;
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const lower = axis === "x" ? rect.left : rect.top,
          upper = axis === "x" ? rect.right : rect.bottom;
        const d =
          point(event) < lower
            ? lower - point(event)
            : point(event) > upper
              ? point(event) - upper
              : 0;
        if (d < distance) {
          distance = d;
          best = node;
        }
      }
      if (best) {
        const rect = best.getBoundingClientRect();
        const middle = axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        const next = {
          id: best.getAttribute(attribute) as T,
          edge: point(event) < middle ? ("before" as const) : ("after" as const),
        };
        current.target = next;
        setTarget(next);
      }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = start.current;
      if (current?.active && current.target && current.target.id !== current.id) {
        const destination = current.target;
        setOrder((old) => {
          const next = old.filter((item) => item !== current.id);
          next.splice(
            next.indexOf(destination.id) + (destination.edge === "after" ? 1 : 0),
            0,
            current.id,
          );
          return next;
        });
      }
      cancel();
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  });
  return { dragged, target, bind, cancel };
}
