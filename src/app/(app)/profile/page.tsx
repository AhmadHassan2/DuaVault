import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { ProfileView } from "@/components/views/profile-view";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <ClientGate>
      <ProfileView />
    </ClientGate>
  );
}
