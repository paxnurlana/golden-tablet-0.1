import { Component, lazy, Suspense, useState, type ReactNode } from "react";
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
  const [resetReady, setResetReady] = useState(false);
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
      <div className="demo-banner flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs">
        <span>Демо · вымышленные торговые данные · изменения остаются в твоём браузере</span>
        <div className="flex items-center gap-4">
          <details className="relative">
            <summary className="cursor-pointer text-sky-300">Как посмотреть</summary>
            <div className="absolute right-0 top-8 z-[100] w-80 rounded-xl border bg-background p-4 text-sm shadow-xl">
              <p className="font-semibold">Сделка → разбор → действие → прогресс</p>
              <ol className="mt-3 list-decimal space-y-2 pl-4">
                <li>Открой Journal, выбери аккаунт и сделку.</li>
                <li>В Trading Review выбери день октября: подготовка, Live Session и итоги.</li>
                <li>Посмотри задачи в Workflow, модели в Playbooks и оценки в Progress.</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Можно менять записи и пробовать основные сценарии. Брокерские подключения, AI и
                загрузка файлов доступны в полной локальной версии. Это учебный пример, а не
                результат торговли и не финансовая рекомендация.
              </p>
            </div>
          </details>
          <button
            onClick={() => {
              if (resetReady) resetDemo();
              else setResetReady(true);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            {resetReady ? "Подтвердить сброс" : "Сбросить демо"}
          </button>
          {resetReady && <button onClick={() => setResetReady(false)}>Отмена</button>}
        </div>
      </div>
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
