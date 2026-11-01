import { Suspense } from "react";
import { JournalCatalogClient } from "@/components/journal-catalog-client";
export default function CatalogsPage() {
  return (
    <Suspense
      fallback={<div className="p-5 text-sm text-muted-foreground">Загрузка справочников…</div>}
    >
      <JournalCatalogClient />
    </Suspense>
  );
}
