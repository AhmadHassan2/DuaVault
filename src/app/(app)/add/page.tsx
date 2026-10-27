import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { AddView } from "@/components/views/add-view";

export const metadata: Metadata = { title: "Add" };

export default function Page() {
  return (
    <ClientGate>
      <AddView />
    </ClientGate>
  );
}
