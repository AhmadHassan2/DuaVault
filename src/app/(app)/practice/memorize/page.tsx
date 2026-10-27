import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { MemorizeView } from "@/components/views/memorize-view";

export const metadata: Metadata = { title: "Memorize" };

export default function Page() {
  return (
    <ClientGate>
      <MemorizeView />
    </ClientGate>
  );
}
