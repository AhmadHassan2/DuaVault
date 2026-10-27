"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, Trash2 } from "lucide-react";
import type { JournalEntry } from "@/core/types";
import { TOPICS } from "@/core/classify/topics";
import { getRepository } from "@/lib/data/repository";
import { errorMessage } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Draft = Omit<JournalEntry, "id" | "createdAt" | "updatedAt"> & { id?: string };

const EMPTY: Draft = { title: "", body: "", arabicText: "", topic: "", reminderEnabled: false, reminderTime: "21:00" };

export function JournalEntryView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const [draft, setDraft] = useState<Draft | null>(isNew ? EMPTY : null);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getRepository()
      .getJournal(id)
      .then((e) => (e ? setDraft(e) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [id, isNew]);

  if (missing) {
    return (
      <p className="text-muted-foreground">
        That entry doesn&apos;t exist. <Link href="/journal" className="text-primary hover:underline">Back to journal</Link>
      </p>
    );
  }
  if (!draft) return <div className="paper-card h-96 animate-pulse" />;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await getRepository().saveJournal(draft);
      toast.success("Saved privately");
      if (isNew) router.replace(`/journal/${saved.id}`);
      else setDraft(saved);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remindersSupported = typeof window !== "undefined" && "Notification" in window;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/journal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Journal
      </Link>
      <div className="paper-card space-y-5 p-5 sm:p-8">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" /> Private · your own words, not Quran or hadith
        </p>
        <Input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Title"
          aria-label="Title"
          maxLength={200}
          className="h-auto border-0 bg-transparent px-0 font-display text-3xl shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder="O Allah… / Today I reflected on…"
          aria-label="Entry"
          className="min-h-56 resize-y border-0 bg-transparent px-0 font-display text-lg leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="space-y-1.5">
          <Label htmlFor="j-ar">In Arabic (optional)</Label>
          <Textarea
            id="j-ar"
            dir="rtl"
            lang="ar"
            value={draft.arabicText}
            onChange={(e) => setDraft({ ...draft, arabicText: e.target.value })}
            className="arabic min-h-20 text-xl"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="j-topic">Topic</Label>
            <Select value={draft.topic || "none"} onValueChange={(v) => setDraft({ ...draft, topic: v === "none" ? "" : v })}>
              <SelectTrigger id="j-topic" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No topic</SelectItem>
                {TOPICS.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="j-rem">Reminder</Label>
            <div className="flex h-8 items-center gap-3">
              <Switch
                id="j-rem"
                checked={draft.reminderEnabled}
                onCheckedChange={async (on) => {
                  if (on && remindersSupported && Notification.permission === "default") await Notification.requestPermission();
                  setDraft({ ...draft, reminderEnabled: on });
                }}
              />
              <Input
                type="time"
                value={draft.reminderTime ?? "21:00"}
                disabled={!draft.reminderEnabled}
                onChange={(e) => setDraft({ ...draft, reminderTime: e.target.value })}
                className="w-32"
                aria-label="Reminder time"
              />
            </div>
          </div>
        </div>
        {draft.reminderEnabled && (
          <p className="text-xs text-muted-foreground">
            The reminder time is saved with this entry. Scheduled notifications aren&apos;t delivered yet — that needs a future native app or push setup.
          </p>
        )}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          {!isNew ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                if (!draft.id || !window.confirm("Delete this journal entry?")) return;
                await getRepository().deleteJournal(draft.id);
                router.push("/journal");
              }}
            >
              <Trash2 /> Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={saving || (!draft.title.trim() && !draft.body.trim() && !draft.arabicText.trim())}>
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
