"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { config } from "@/lib/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Credentials = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

function nextPath(): string {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/home";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/home";
}

export function AuthView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  if (config.dataMode === "local") {
    return (
      <Shell>
        <h1 className="text-2xl font-medium">No account needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          DuaVault is running in on-device mode: your vault lives privately in this browser. To sync across devices, configure Supabase (see the
          README).
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/home">Open my vault</Link>
        </Button>
      </Shell>
    );
  }

  const withPassword = async (mode: "signin" | "signup") => {
    const parsed = Credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error, data } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(parsed.data)
        : await supabase.auth.signUp({
            ...parsed.data,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/home` },
          });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (mode === "signup" && !data.session) {
      toast.success("Check your email to confirm your account.");
      return;
    }
    window.location.href = nextPath();
  };

  const magicLink = async () => {
    if (!z.email().safeParse(email).success) return toast.error("Enter a valid email");
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setLinkSent(true);
  };

  const failedCallback = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "callback";

  return (
    <Shell>
      <h1 className="text-2xl font-medium">Welcome</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to keep your vault in sync, privately.</p>
      {failedCallback && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">That sign-in link didn&apos;t work. Please try again.</p>}
      <div className="mt-6 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Tabs defaultValue="password">
          <TabsList className="w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="link">Email link</TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => withPassword("signin")} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Sign in
              </Button>
              <Button variant="outline" onClick={() => withPassword("signup")} disabled={busy}>
                Create account
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="link" className="space-y-3 pt-2">
            {linkSent ? (
              <p className="rounded-lg bg-sage-soft px-3 py-3 text-sm text-forest">Check your inbox for a sign-in link.</p>
            ) : (
              <Button className="w-full" onClick={magicLink} disabled={busy}>
                <Mail /> Email me a sign-in link
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="paper-card w-full max-w-sm p-6 sm:p-8">
        <Link href="/" className="mb-8 inline-block">
          <Wordmark />
        </Link>
        {children}
      </div>
    </div>
  );
}
