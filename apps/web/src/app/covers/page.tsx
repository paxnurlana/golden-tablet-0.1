import { JOURNAL_COVERS, coverForResult } from "@/lib/journal-covers";
import { JournalResultBadge } from "@/components/journal-icons";
export default function CoversPage() {
  return (
    <main className="min-w-0 flex-1 p-5">
      <h1 className="mb-5 text-xl font-semibold">Обложки журнала</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {JOURNAL_COVERS.map((cover) => (
          <div key={cover.key} className="overflow-hidden rounded-xl border">
            <img
              src={coverForResult(cover.result)}
              alt={`Обложка ${cover.result}`}
              className="aspect-[3/1] w-full object-cover"
            />
            <div className="p-3">
              <JournalResultBadge name={cover.result} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
