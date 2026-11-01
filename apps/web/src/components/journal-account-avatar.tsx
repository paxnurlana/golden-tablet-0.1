import type { Term } from "@/server/personal-journal";

export function JournalAccountAvatar({ term, size = "size-7" }: { term?: Term; size?: string }) {
  return (
    <span
      title={term?.name ?? "Аккаунт"}
      className={`inline-grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-foreground/10 text-[10px] font-semibold`}
    >
      {term?.logo ? (
        <img src={term.logo} alt={term.name} className="h-full w-full object-contain" />
      ) : (
        (term?.name ?? "?").slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
