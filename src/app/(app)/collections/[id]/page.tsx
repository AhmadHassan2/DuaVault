import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { CollectionView } from "@/components/views/collection-view";

export const metadata: Metadata = { title: "Collection" };

export default function Page() {
  return (
    <ClientGate>
      <CollectionView />
    </ClientGate>
  );
}
