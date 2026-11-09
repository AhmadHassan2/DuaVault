import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientGate, PageSkeleton } from "@/components/shell/client-gate";
import { JournalEntryView } from "@/components/views/journal-entry-view";

export const metadata: Metadata = { title: "Journal entry" };

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={<PageSkeleton />}><JournalEntryView /></Suspense>
    </ClientGate>
  );
}
