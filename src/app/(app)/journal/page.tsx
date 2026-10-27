import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { JournalView } from "@/components/views/journal-view";

export const metadata: Metadata = { title: "Journal" };

export default function Page() {
  return (
    <ClientGate>
      <JournalView />
    </ClientGate>
  );
}
