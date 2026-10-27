import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { FindView } from "@/components/views/find-view";

export const metadata: Metadata = { title: "Find what you need" };

export default function Page() {
  return (
    <ClientGate>
      <FindView />
    </ClientGate>
  );
}
