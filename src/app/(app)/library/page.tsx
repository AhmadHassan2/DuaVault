import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { LibraryView } from "@/components/views/library-view";

export const metadata: Metadata = { title: "Library" };

export default function Page() {
  return (
    <ClientGate>
      <LibraryView />
    </ClientGate>
  );
}
