import type { Metadata } from "next";
import { ClientGate } from "@/components/shell/client-gate";
import { AuthView } from "@/components/views/auth-view";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <ClientGate fallback={null}>
      <AuthView />
    </ClientGate>
  );
}
