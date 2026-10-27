"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Brain, Eye, EyeOff, PartyPopper } from "lucide-react";
import type { MemorizationProgress } from "@/core/types";
import { review, reviewQueue, type MemorizationRating } from "@/core/schedule/srs";
import { useItems, useProgress } from "@/lib/data/hooks";
import { getRepository } from "@/lib/data/repository";
import { errorMessage } from "@/lib/actions";
import { ArabicText, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const RATINGS: Array<{ rating: MemorizationRating; label: string; hint: string }> = [
  { rating: "learning", label: "Still learning", hint: "See it again tomorrow" },
  { rating: "familiar", label: "Familiar", hint: "A few days" },
  { rating: "memorized", label: "Memorized", hint: "A week or more" },
];

export function MemorizeView() {
  const items = useItems();
  const progress = useProgress();
  const [showArabic, setShowArabic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [practiceAll, setPracticeAll] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [againQueue, setAgainQueue] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(0);

  // Freeze the session's queue when it starts so ratings don't reshuffle cards mid-review.
  const sessionIds = useMemo(() => {
    const prog = progress.data ?? [];
    const base = practiceAll ? [...prog].sort((a, b) => a.dueAt.localeCompare(b.dueAt)) : reviewQueue(prog);
    return base.map((p) => p.itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.loading, practiceAll]);

  if (items.loading || progress.loading) return <div className="paper-card h-96 animate-pulse" />;

  const queue = [...sessionIds.filter((id) => !done.includes(id)), ...againQueue];
  const currentId = queue[0];
  const item = items.data?.find((i) => i.id === currentId);
  const prog = (progress.data ?? []).find((p) => p.itemId === currentId);
  const total = reviewed + queue.length;

  const rate = async (rating: MemorizationRating) => {
    if (!prog || !item) return;
    try {
      const next: MemorizationProgress = review(prog, rating);
      await getRepository().saveProgress(next);
      await getRepository().recordPractice(item.id, "memorization_review", rating);
      setRevealed(false);
      setReviewed((n) => n + 1);
      if (againQueue[0] === item.id) setAgainQueue((q) => q.slice(1));
      else setDone((d) => [...d, item.id]);
      // "Still learning" cards come back once more at the end of this session.
      if (rating === "learning" && !againQueue.includes(item.id) && againQueue[0] !== item.id) {
        setAgainQueue((q) => [...q, item.id]);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const header = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <Link href="/practice" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Practice
      </Link>
      {total > 0 && (
        <span className="text-sm text-muted-foreground tabular-nums">
          {Math.min(reviewed + 1, total)} / {total}
        </span>
      )}
    </div>
  );

  if (!(progress.data ?? []).length) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <EmptyState
          icon={Brain}
          title="Nothing to memorize yet"
          description="Open a dua and choose “Memorize”, or set its memorization status."
          action={
            <Button asChild>
              <Link href="/library/dua">Browse duas</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!item || !prog) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <EmptyState
          icon={PartyPopper}
          title={done.length ? "Session complete — bārak Allāhu fīk" : "You're all caught up"}
          description={done.length ? `You reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"}.` : "Nothing is due right now. You can still practise everything."}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setDone([]);
                setAgainQueue([]);
                setReviewed(0);
                setPracticeAll(true);
              }}
            >
              Practise all cards anyway
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <Progress value={total ? (reviewed / total) * 100 : 0} className="mb-6" aria-label="Session progress" />

      <AnimatePresence mode="wait">
        <motion.article
          key={item.id + againQueue.length}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          className="paper-card min-h-80 p-6 sm:p-10"
          data-testid="flashcard"
        >
          <p className="text-sm text-muted-foreground capitalize">{prog.state}</p>
          <h1 className="mt-2 text-2xl font-medium sm:text-3xl">{item.title}</h1>

          <div className="mt-6 min-h-24">
            {revealed || showArabic ? (
              item.arabicText ? (
                <ArabicText size="xl">{item.arabicText}</ArabicText>
              ) : (
                <p className="text-muted-foreground">No Arabic saved for this item.</p>
              )
            ) : (
              <p className="text-muted-foreground italic">Recite the Arabic from memory, then reveal.</p>
            )}
            {item.transliteration && (revealed || showArabic) && (
              <p className="mt-4 text-sm text-muted-foreground italic">{item.transliteration}</p>
            )}
            {(revealed || showTranslation) && item.englishText && (
              <p className="mt-5 font-display text-lg leading-relaxed text-foreground/85">{item.englishText}</p>
            )}
          </div>

          {!revealed ? (
            <Button className="mt-8 w-full" size="lg" onClick={() => setRevealed(true)}>
              <Eye /> Reveal answer
            </Button>
          ) : (
            <div className="mt-8 grid gap-2 sm:grid-cols-3">
              {RATINGS.map((r) => (
                <Button key={r.rating} variant={r.rating === "memorized" ? "default" : "outline"} className="h-auto flex-col py-2.5" onClick={() => rate(r.rating)}>
                  <span>{r.label}</span>
                  <span className="text-[11px] font-normal opacity-70">{r.hint}</span>
                </Button>
              ))}
            </div>
          )}
        </motion.article>
      </AnimatePresence>

      <div className="mt-5 flex flex-wrap justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Switch id="show-ar" checked={showArabic} onCheckedChange={setShowArabic} />
          <Label htmlFor="show-ar" className="flex items-center gap-1.5">
            {showArabic ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} Arabic
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-tr" checked={showTranslation} onCheckedChange={setShowTranslation} />
          <Label htmlFor="show-tr" className="flex items-center gap-1.5">
            {showTranslation ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} Translation
          </Label>
        </div>
      </div>
    </div>
  );
}
