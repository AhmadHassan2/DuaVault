import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { ItemView } from "@/components/views/item-view";

export const metadata: Metadata = { title: "Saved item" };

export default function Page() {
  return (
    <ClientGate>
      <ItemView />
    </ClientGate>
  );
}
