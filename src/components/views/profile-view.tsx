"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BookMarked, CalendarPlus, Database, Download, Laptop, LogOut, Moon, NotebookPen, Search, Sun, Trash2, FolderHeart } from "lucide-react";
import { config } from "@/lib/config";
import { getRepository } from "@/lib/data/repository";
import { useItems, useLiveQuery } from "@/lib/data/hooks";
import { downloadReminderCalendar, notificationsSupported, requestNotificationPermission } from "@/lib/reminders";
import { getReferenceProvider, type DatasetStatus } from "@/lib/references/static-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/actions";
import { useTheme, type ThemePreference } from "@/components/theme/use-theme";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

function Card({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="paper-card p-5 sm:p-6">
      <h2 className="text-xl font-medium">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const THEMES: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Laptop },
];

export function ProfileView() {
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<DatasetStatus | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const reminders = useLiveQuery((r) => r.getReminderPreferences());
  const items = useItems();
  const withReminders = (items.data ?? []).filter((i) => i.reminderTime).sort((a, b) => a.reminderTime!.localeCompare(b.reminderTime!));
  const [permission, setPermission] = useState<string>(() => (notificationsSupported() ? Notification.permission : "unsupported"));

  useEffect(() => {
    void getReferenceProvider().status().then(setStatus);
    if (config.dataMode === "supabase") {
      void getSupabaseBrowserClient()
        .auth.getUser()
        .then(({ data }) => setEmail(data.user?.email ?? null));
    }
  }, []);

  const exportData = async () => {
    try {
      const bundle = await getRepository().exportAll();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `duavault-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" />

      <nav className="grid grid-cols-3 gap-2 lg:hidden" aria-label="More">
        {[
          { href: "/find", label: "Find", icon: Search },
          { href: "/collections", label: "Collections", icon: FolderHeart },
          { href: "/journal", label: "Journal", icon: NotebookPen },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-lg border bg-card py-4 text-sm hover:bg-muted">
            <Icon className="size-5 text-primary" /> {label}
          </Link>
        ))}
      </nav>

      <Card title="Account" description={config.dataMode === "local" ? "You're using DuaVault in on-device mode." : undefined}>
        {config.dataMode === "local" ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Everything is stored in this browser&apos;s private storage. There is no account and nothing is uploaded.</p>
            <p>Clearing site data removes your vault — export a backup from time to time.</p>
            {config.supabaseMisconfigured && (
              <p className="text-warning">Supabase mode was requested, but NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are missing.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Signed in as <strong>{email ?? "…"}</strong>
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                await getSupabaseBrowserClient().auth.signOut();
                // Full reload so no signed-in client state survives sign-out.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/";
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        )}
      </Card>

      <Card title="Appearance">
        <div className="inline-flex rounded-md border bg-muted/50 p-1" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => setTheme(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                theme === id ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Reminders"
        description="Morning, evening and before-sleep duas get a reminder at the right time of day automatically. You can change it on any item."
      >
        {withReminders.length ? (
          <ul className="mb-4 divide-y rounded-md border">
            {withReminders.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Bell className="size-3.5 shrink-0 text-gold" />
                <Link href={`/items/${i.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {i.title}
                </Link>
                <span className="text-muted-foreground tabular-nums">{i.reminderTime}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">No reminders yet. Save a morning or evening dua, or switch one on from any item.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!withReminders.length} onClick={() => downloadReminderCalendar(withReminders)}>
            <CalendarPlus /> Add all to my calendar
          </Button>
          {permission === "default" && (
            <Button variant="ghost" onClick={async () => setPermission(await requestNotificationPermission())}>
              <Bell /> Allow notifications
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The calendar file repeats daily and alerts you even when DuaVault is closed. While DuaVault is open, you&apos;ll also get a
          notification{permission === "denied" ? " (notifications are blocked in your browser settings)" : ""} and a card on Home.
        </p>
      </Card>

      <Card title="Daily dua" description="Choose when you'd like your daily dua.">
        {reminders.data && (
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="daily-rem"
              checked={reminders.data.dailyReminderEnabled}
              onCheckedChange={async (on) => {
                if (on && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
                await getRepository().saveReminderPreferences({ ...reminders.data!, dailyReminderEnabled: on });
              }}
            />
            <Label htmlFor="daily-rem">Remind me at</Label>
            <Input
              type="time"
              className="w-32"
              value={reminders.data.dailyReminderTime}
              disabled={!reminders.data.dailyReminderEnabled}
              onChange={(e) => getRepository().saveReminderPreferences({ ...reminders.data!, dailyReminderTime: e.target.value })}
              aria-label="Daily reminder time"
            />
            <p className="w-full text-xs text-muted-foreground">
              Saved as a preference. Delivering scheduled notifications needs push or a native app, which aren&apos;t set up yet.
            </p>
          </div>
        )}
      </Card>

      <Card title="Reference datasets" description="Used to check what you save. Nothing is ever marked verified without one of these.">
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <BookMarked className="mt-0.5 size-4 shrink-0 text-primary" />
            {status?.quran.loaded ? (
              <div>
                <p className="font-medium">
                  {status.quran.sourceName} — {status.quran.verses.toLocaleString()} verses
                  {status.quran.translationName && ` · ${status.quran.translationName}`}
                </p>
                <p className="text-xs text-muted-foreground">{status.quran.licence}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {status ? (
                  <>
                    Quran dataset not installed. Run <code className="rounded bg-muted px-1">pnpm fetch:quran</code> to enable Quran verification.
                  </>
                ) : (
                  "Checking…"
                )}
              </p>
            )}
          </li>
          <li className="flex gap-3">
            <Database className="mt-0.5 size-4 shrink-0 text-primary" />
            {status?.references.length ? (
              <ul className="space-y-1">
                {status.references.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.name}</span> — {r.entryCount} entries <span className="text-xs text-muted-foreground">({r.licence})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No hadith or dua datasets imported. Use <code className="rounded bg-muted px-1">pnpm import:references</code> with a vetted dataset.
              </p>
            )}
          </li>
        </ul>
      </Card>

      <Card title="Your data">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download /> Export as JSON
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive">
                <Trash2 /> Delete everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your whole vault?</AlertDialogTitle>
                <AlertDialogDescription>
                  All saved items, screenshots, collections, practice history and journal entries will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await getRepository().deleteAll();
                      toast.success("Your vault is now empty");
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      <Card title="About">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Text recognition runs in your browser with Tesseract. Categories come from transparent keyword rules, not an AI model, so they
            can be wrong — you always review before saving.
          </p>
          <p>DuaVault never invents references, grades, translations or transliterations, and does not issue religious rulings.</p>
          <p>
            To install, use your browser&apos;s “Add to Home Screen” / “Install app”. Sharing directly from other apps works on supported
            Android browsers once installed; on iPhone, save the screenshot and add it here.
          </p>
        </div>
      </Card>
    </div>
  );
}
