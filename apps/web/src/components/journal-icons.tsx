import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChartCandlestick,
  X,
  Tags,
  Flame,
  LogOut,
  ScanSearch,
  CircleHelp,
  CircleSlash,
  Clock3,
  Scale,
  FlaskConical,
  GitBranch,
  Hash,
  Layers3,
  NotebookPen,
  RotateCcw,
  ShieldCheck,
  Target,
  TriangleAlert,
  Trophy,
  Wallet,
  Waypoints,
  Zap,
  Ruler,
  Check,
  Gauge,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { DETAILS, CHARACTER_TONES,resultIconColor } from "@/lib/trade-classification";
import { ResultGlyph } from "./result-glyph";
export function JournalResultIcon({
  name,
  className = "size-7",
  plain = false,
  detail,
  missed,
}: {
  name: string;
  className?: string;
  plain?: boolean;
  detail?: string;
  missed?: number|null;
}) {
  return (
    <span
      role="img"
      aria-label={name === "BE" ? "Breakeven" : name}
      title={DETAILS.find(d => d.id === detail)?.label ?? name}
      className={`inline-flex shrink-0 items-center justify-center align-middle leading-none ${className}`}
      style={{color:resultIconColor(name,detail,missed)}}
    >
      <ResultGlyph name={name} detail={detail} missed={missed}/>
    </span>
  );
}
export function resultBadgeClass(name: string) {
  return name === "Win"
    ? "bg-emerald-500/15 text-emerald-400"
    : name === "Loss"
      ? "bg-rose-500/15 text-rose-400"
      : name === "BE" || name === "Breakeven"
        ? "bg-blue-500/15 text-blue-400"
        : name === "Missed"
            ? "bg-orange-500/15 text-orange-400"
          : name === "Hypothesis"
            ? "bg-slate-400/15 text-slate-100"
            : "bg-slate-400/15 text-slate-300";
}
export function JournalResultBadge({ name, icon = false }: { name: string; icon?: boolean }) {
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold ${resultBadgeClass(name)}`}
    >
      {icon && <JournalResultIcon name={name} className="size-5" />}
      {name === "BE" ? "Breakeven" : name}
    </span>
  );
}
export function JournalFieldIcon({
  field,
  className = "size-3.5",
}: {
  field: string;
  className?: string;
}) {
  if (field === "executionTags") return <Tags aria-hidden="true" className={`${className} text-muted-foreground`} />;
  if (field === "realisedR")
    return (
      <span
        aria-hidden="true"
        className={`${className} inline-flex shrink-0 items-center justify-center text-[8px] font-bold tracking-tighter text-muted-foreground`}
      >
        RR
      </span>
    );
  if (field === "realisedTicks")
    return (
      <span className={`relative inline-flex shrink-0 ${className}`}>
        <Ruler aria-hidden="true" strokeWidth={1.7} className="size-full text-muted-foreground" />
        <Check
          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-sm bg-background text-muted-foreground"
          strokeWidth={2.2}
        />
      </span>
    );
  const Icon =
    field === "date"
      ? CalendarDays
      : field === "instrument"
        ? ChartCandlestick
        : field === "setup"
          ? Waypoints
          : field === "storyline"
            ? GitBranch
            : field === "trigger"
              ? Zap
              : field === "vp"
                ? Layers3
                : field === "vwap"
                  ? Activity
                  : field === "account" || field === "accounts"
                    ? Wallet
                    : field === "type"
                      ? ShieldCheck
                      : field === "result"
                        ? Trophy
                        : field === "quickNote"
                          ? NotebookPen
                          : field === "openedAt" || field === "closedAt"
                            ? Clock3
                            : field === "mode"
                              ? Layers3
                              : field === "riskTicks"
                                ? Ruler
                                : field === "realisedR"
                                  ? Gauge
                                  : field === "mfe"
                                    ? ArrowUpRight
                                    : field === "mae"
                                      ? ArrowDownRight
                                      : field === "direction"
                                        ? ArrowUpDown
                                        : Hash;
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.7}
      className={`${className} shrink-0 text-muted-foreground`}
    />
  );
}
export function JournalTermIcon({ kind, name }: { kind: string; name: string }) {
  if (kind === "executionTags") {
    const Icon = name === "Гипотеза" ? FlaskConical : name === "FOMO" ? Flame : name === "Revenge" ? RotateCcw : name === "Импульсивный вход" ? Zap : name === "Нарушение правил" ? TriangleAlert : name === "Ранний выход" ? LogOut : Tags;
    return <Icon aria-hidden="true" style={{color:CHARACTER_TONES[name]?.color ?? '#94a3b8'}} className="size-3.5" />;
  }
  if (kind === "result") return <JournalResultIcon name={name} className="size-4" />;
  if (kind === "direction")
    return name === "Long" ? (
      <ArrowUp className="size-3.5 text-emerald-400" />
    ) : (
      <ArrowDown className="size-3.5 text-rose-400" />
    );
  if (kind === "type") {
    const Icon =
      name === "Clear"
        ? ShieldCheck
        : name === "Dirty"
          ? CircleSlash
          : name === "Re-entry"
            ? RotateCcw
            : name === "Anomaly"
              ? TriangleAlert
              : ShieldCheck;
    const color =
      name === "Clear"
        ? "text-emerald-400"
        : name === "Dirty"
          ? "text-rose-400"
          : name === "Anomaly"
            ? "text-amber-400"
            : "text-sky-400";
    return <Icon aria-hidden="true" strokeWidth={1.8} className={`size-3.5 ${color}`} />;
  }
  return <JournalFieldIcon field={kind} />;
}
