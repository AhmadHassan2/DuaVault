import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { CollectionsView } from "@/components/views/collections-view";

export const metadata: Metadata = { title: "Collections" };

export default function Page() {
  return (
    <ClientGate>
      <CollectionsView />
    </ClientGate>
  );
}
