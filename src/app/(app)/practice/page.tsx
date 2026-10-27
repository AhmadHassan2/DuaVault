import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { PracticeView } from "@/components/views/practice-view";

export const metadata: Metadata = { title: "Practice" };

export default function Page() {
  return (
    <ClientGate>
      <PracticeView />
    </ClientGate>
  );
}
