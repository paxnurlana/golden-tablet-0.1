import { useSyncExternalStore } from "react";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const hrefFor = (href: string) =>
  href.startsWith("/") && (!base || !href.startsWith(base + "/")) ? base + href : href;
let installed = false;
/** Match the native-history integration supplied by Next's app router. */
export function installBrowserHistory() {
  if (installed) return;
  installed = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method].bind(history);
    history[method] = (data, title, url) => {
      let target = url?.toString();
      if (target?.startsWith("/")) target = hrefFor(target);
      original(data, title, target);
      window.dispatchEvent(new PopStateEvent("popstate", { state: data }));
    };
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
export function navigate(href: string, replace = false) {
  history[replace ? "replaceState" : "pushState"]({}, "", hrefFor(href));
  window.scrollTo(0, 0);
}
function locationKey() {
  return window.location.pathname + window.location.search;
}
export function usePathname() {
  useSyncExternalStore(subscribe, locationKey);
  return window.location.pathname.slice(base.length) || "/";
}
export function useSearchParams() {
  useSyncExternalStore(subscribe, locationKey);
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname.slice(base.length);
  if (path.startsWith("/trades/")) params.set("entry", path.split("/")[2] ?? "");
  if (/^\/journal\/\d{4}-\d{2}-\d{2}$/.test(path)) {
    params.set("review", "day");
    params.set("date", path.split("/")[2] ?? "");
  }
  return params;
}
const router = {
  push: (url: string) => navigate(url),
  replace: (url: string) => navigate(url, true),
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => window.dispatchEvent(new PopStateEvent("popstate")),
  prefetch: () => Promise.resolve(),
};
export function useRouter() {
  return router;
}
export const redirect = (url: string) => navigate(url, true);
export const notFound = () => navigate("/");
