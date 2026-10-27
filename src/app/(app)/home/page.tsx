import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { HomeView } from "@/components/views/home-view";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return (
    <ClientGate>
      <HomeView />
    </ClientGate>
  );
}
