// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
const calls = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../src/lib/use-api", () => ({ postJson: calls.post }));
import { useAccountAutosave } from "../src/components/use-account-autosave";
let root: Root, host: HTMLDivElement;
function Editor() {
  const [name, setName] = useState("old");
  const save = useAccountAutosave(
    "draft:test",
    { action: "firm", id: "stable-id", name },
    () => {},
  );
  return (
    <>
      <button onClick={() => setName("new")}>edit</button>
      <button onClick={() => setName("newest")}>again</button>
      <span>{save.status}</span>
    </>
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  calls.post.mockReset();
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
it("autosaves changes and flushes on close without a Save button", async () => {
  calls.post.mockResolvedValue({});
  await act(async () => root.render(<Editor />));
  await act(async () => host.querySelector("button")!.click());
  expect(calls.post).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  expect(calls.post).toHaveBeenCalledWith(
    "/api/personal-accounts",
    expect.objectContaining({ id: "stable-id", name: "new" }),
  );
  expect(host.textContent).toContain("Сохранено");
  await act(async () => host.querySelectorAll("button")[1]!.click());
  await act(async () => root.unmount());
  expect(calls.post).toHaveBeenLastCalledWith(
    "/api/personal-accounts",
    expect.objectContaining({ name: "newest" }),
  );
});
it("serializes updates and keeps a recovery draft on network failure", async () => {
  calls.post.mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<Editor />));
  await act(async () => host.querySelector("button")!.click());
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  expect(host.textContent).toContain("Не сохранено");
  expect(JSON.parse(localStorage.getItem("draft:test")!).name).toBe("new");
});
