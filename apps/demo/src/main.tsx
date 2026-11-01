import { Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "@/components/shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NumericInputPolicy } from "@/components/numeric-input-policy";
import { installDemoApi, resetDemo } from "./demo-api";
import { usePathname, installBrowserHistory } from "./shims/navigation";
import "./style.css";
const saved = sessionStorage.getItem("golden-tablet-route");
if (saved) {
  sessionStorage.removeItem("golden-tablet-route");
  if (saved.startsWith(import.meta.env.BASE_URL)) history.replaceState({}, "", saved);
}
installDemoApi();
installBrowserHistory();
const pages: Record<string, ReturnType<typeof lazy>> = {
  "/": lazy(() => import("@/app/page")),
  "/trades": lazy(() => import("@/app/trades/page")),
  "/journal": lazy(() => import("@/app/journal/page")),
  "/calendar": lazy(() => import("@/app/journal/page")),
  "/accounts": lazy(() => import("@/app/accounts/page")),
  "/catalogs": lazy(() => import("@/app/catalogs/page")),
  "/reports": lazy(() => import("@/app/reports/page")),
  "/prop-firms": lazy(() => import("@/app/prop-firms/page")),
  "/workflow": lazy(() => import("@/app/workflow/page")),
  "/notebook": lazy(() => import("@/app/notebook/page")),
  "/playbooks": lazy(() => import("@/app/playbooks/page")),
  "/progress": lazy(() => import("@/app/progress/page")),
};
class DemoBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div role="alert" className="p-10">
        <h1 className="text-xl">Не удалось открыть раздел</h1>
        <p className="mt-2 text-muted-foreground">
          Обнови страницу или верни демо к исходным данным.
        </p>
        <button className="mt-4 rounded border p-2" onClick={resetDemo}>
          Сбросить демо
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const path = usePathname();
  const Page =
    pages[path] ??
    (path.startsWith("/trades/")
      ? pages["/trades"]
      : path.startsWith("/journal/")
        ? pages["/journal"]
        : pages["/"]);
  return (
    <TooltipProvider delayDuration={300}>
      <NumericInputPolicy />
      <Shell>
        <DemoBoundary key={path}>
          <Suspense fallback={<p className="p-8 text-muted-foreground">Открываем раздел…</p>}>
            <Page />
          </Suspense>
        </DemoBoundary>
      </Shell>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
