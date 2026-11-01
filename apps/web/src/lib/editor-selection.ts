/** Intersect a document selection with a block, retaining unselected text. */
export function selectedTextSlice(range: Range, element: HTMLElement, text: string) {
  if (!range.intersectsNode(element)) return null;
  const whole = document.createRange();
  whole.selectNodeContents(element);
  const overlap = whole.cloneRange();
  if (range.compareBoundaryPoints(Range.START_TO_START, whole) > 0)
    overlap.setStart(range.startContainer, range.startOffset);
  if (range.compareBoundaryPoints(Range.END_TO_END, whole) < 0)
    overlap.setEnd(range.endContainer, range.endOffset);
  if (overlap.collapsed && text) return null;
  const prefix = whole.cloneRange();
  prefix.setEnd(overlap.startContainer, overlap.startOffset);
  const start = Math.min(text.length, prefix.toString().length);
  const end = Math.min(text.length, start + overlap.toString().length);
  // Textareas can expose an empty DOM range although their rendered value is selected.
  const covers = range.compareBoundaryPoints(Range.START_TO_START, whole) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, whole) >= 0;
  return covers ? { start: 0, end: text.length } : { start, end };
}
