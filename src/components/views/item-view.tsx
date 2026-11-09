"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Brain, Check, Copy, FileQuestion, Heart, ImageIcon, Pencil, Trash2 } from "lucide-react";
import type { MemorizationState } from "@/core/types";
import { newProgress } from "@/core/schedule/srs";
import { topicLabel } from "@/core/classify/topics";
import { useItem, useProgress, useScreenshotUrl } from "@/lib/data/hooks";
import { getRepository } from "@/lib/data/repository";
import { errorMessage, markPracticed, toggleFavorite } from "@/lib/actions";
import { relativeTime } from "@/lib/format";
import { ArabicText, EmptyState } from "@/components/common";
import { TypeLabel } from "@/components/items/item-card";
import { VerificationPanel } from "@/components/items/verification-panel";
import { CollectionPicker } from "@/components/items/collection-picker";
import { EditItemDialog } from "@/components/items/edit-item-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { suggestedReminderTime } from "@/core/schedule/reminders";
import { ReminderControl } from "@/components/reminders/reminder-control";
import { downloadReminderCalendar } from "@/lib/reminders";

export function ItemView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const item = useItem(id);
  const progress = useProgress();
  const screenshotUrl = useScreenshotUrl(item.data?.screenshotKey);
  const [editing, setEditing] = useState(false);
  const recorded = useRef(false);

  // Opening an item counts as revisiting it.
  useEffect(() => {
    if (item.data && !recorded.current) {
      recorded.current = true;
      getRepository().recordPractice(item.data.id, "viewed").catch(() => undefined);
    }
  }, [item.data]);

  if (item.loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="paper-card h-96 animate-pulse" />
      </div>
    );
  }
  if (!item.data) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="This item isn't in your vault"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/library">Back to library</Link>
          </Button>
        }
      />
    );
  }

  const it = item.data;
  const memo = (progress.data ?? []).find((p) => p.itemId === it.id);
  const practicedToday = it.practiceCount > 0 && it.lastReviewedAt && new Date(it.lastReviewedAt).toDateString() === new Date().toDateString();

  const setMemorization = async (state: MemorizationState | "remove") => {
    try {
      const repo = getRepository();
      if (state === "remove") await repo.removeProgress(it.id);
      else await repo.saveProgress({ ...(memo ?? newProgress(it.id)), state });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const copy = async () => {
    const text = [it.arabicText, it.transliteration, it.englishText, it.sourceText].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy on this browser");
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
      <Tabs defaultValue="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <TypeLabel item={it} />
          {it.screenshotKey && (
            <TabsList>
              <TabsTrigger value="card">Reading card</TabsTrigger>
              <TabsTrigger value="original">
                <ImageIcon /> Original
              </TabsTrigger>
            </TabsList>
          )}
        </div>

        <TabsContent value="card">
          <article className="sanctuary-panel px-5 py-7 sm:px-10 sm:py-10" data-testid="reading-card">
            <h1 className="text-3xl leading-tight font-medium sm:text-[2.4rem]">{it.title}</h1>
            {it.arabicText && <ArabicText size="xl" className="mt-8 text-forest">{it.arabicText}</ArabicText>}
            {it.transliteration && (
              <p className="mt-6 border-l-2 border-gold/50 pl-4 text-[1.02rem] leading-relaxed text-muted-foreground italic">{it.transliteration}</p>
            )}
            {it.englishText && (
              <p className="mt-6 font-display text-[1.2rem] leading-[1.75] whitespace-pre-line text-foreground/90 sm:text-[1.3rem]">
                {it.englishText}
              </p>
            )}
            {(it.sourceText || it.verification.referenceLabel) && (
              <p className="mt-6 text-sm text-muted-foreground">
                {it.verification.status === "verified_match" && it.verification.referenceLabel
                  ? `— ${it.verification.referenceLabel}`
                  : `Source as written: ${it.sourceText}`}
              </p>
            )}
            {it.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {it.tags.map((t) => (
                  <span key={t} className="text-xs text-muted-foreground after:ml-1.5 after:content-['·'] last:after:content-none">
                    {topicLabel(t)}
                  </span>
                ))}
              </div>
            )}
          </article>
        </TabsContent>
        <TabsContent value="original">
          <div className="paper-card overflow-hidden p-2">
            {screenshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- private object/signed URL
              <img src={screenshotUrl} alt={`Original screenshot for ${it.title}`} className="mx-auto max-h-[80dvh] rounded-md" />
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading screenshot…</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>

      <aside className="paper-card p-5 lg:sticky lg:top-6" aria-label="Reading tools">
      <p className="eyebrow mb-5">Make it part of your day</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => markPracticed(it)} disabled={!!practicedToday} className="col-span-2">
          <Check /> {practicedToday ? "Practiced today" : "Mark as practiced"}
        </Button>
        <Button variant="outline" onClick={() => toggleFavorite(it)} aria-pressed={it.isFavorite}>
          <Heart className={cn(it.isFavorite && "fill-gold text-gold")} /> {it.isFavorite ? "Favorited" : "Favorite"}
        </Button>
        <CollectionPicker itemId={it.id} />
        <Button variant="ghost" onClick={copy}>
          <Copy /> Copy
        </Button>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      </div>

      <section className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <Brain className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Memorization</p>
          <p className="text-sm text-muted-foreground">
            {memo ? `Next review ${relativeTime(memo.dueAt)}` : "Add it to your list to review with flashcards."}
          </p>
        </div>
        <Select value={memo?.state ?? "not_started"} onValueChange={(v) => setMemorization(v === "not_started" ? "remove" : (v as MemorizationState))}>
          <SelectTrigger className="w-40" aria-label="Memorization status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_started">Not memorizing</SelectItem>
            <SelectItem value="learning">Learning</SelectItem>
            <SelectItem value="familiar">Familiar</SelectItem>
            <SelectItem value="memorized">Memorized</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="mt-4">
        <ReminderControl
          idPrefix="item"
          value={it.reminderTime}
          suggested={suggestedReminderTime(it)}
          onChange={async (reminderTime) => {
            try {
              await getRepository().updateItem(it.id, { reminderTime });
              if (reminderTime) toast.success(`I'll remind you daily at ${reminderTime}`);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
          onAddToCalendar={() => downloadReminderCalendar([it], `duavault-${it.id.slice(0, 8)}.ics`)}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-medium">Source & verification</h2>
        <VerificationPanel verification={it.verification} />
      </section>

      {it.notes && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-medium">Your notes</h2>
          <p className="whitespace-pre-line text-muted-foreground">{it.notes}</p>
        </section>
      )}
      </aside>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <span>
          Saved {relativeTime(it.createdAt)} · practiced {it.practiceCount} {it.practiceCount === 1 ? "time" : "times"}
          {it.ocrConfidence !== null && ` · text read at ${Math.round(it.ocrConfidence)}% confidence`}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{it.title}”?</AlertDialogTitle>
              <AlertDialogDescription>This removes it, its screenshot and its practice history. This can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await getRepository().deleteItem(it.id);
                    toast.success("Deleted");
                    router.push("/library");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </footer>

      <EditItemDialog key={editing ? `edit-${it.updatedAt}` : "closed"} item={it} open={editing} onOpenChange={setEditing} />
    </div>
  );
}
