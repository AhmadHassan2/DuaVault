"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Heart, Sunrise } from "lucide-react";
import type { MemorizationProgress, SavedItem } from "@/core/types";
import { pickDailyItem } from "@/core/schedule/daily";
import { Button } from "@/components/ui/button";
import { ArabicText, EmptyState } from "@/components/common";
import { TypeLabel } from "@/components/items/item-card";
import { VerificationBadge } from "@/components/items/verification-badge";
import { addToMemorization, markPracticed, toggleFavorite } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function DailyCard({
  items,
  progress,
  className,
}: {
  items: SavedItem[];
  progress: MemorizationProgress[];
  className?: string;
}) {
  const [skip, setSkip] = useState(0);
  // Pick once per mount/skip so marking practiced doesn't swap the card away mid-read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pickedId = useMemo(() => pickDailyItem(items, new Date(), skip)?.id ?? null, [skip, items.length]);
  const item = items.find((i) => i.id === pickedId) ?? null;

  if (!item) {
    return (
      <EmptyState
        icon={Sunrise}
        title="No daily dua yet"
        description="Once you've saved a few duas, verses or reminders, one is picked here each day — favouring the ones you haven't opened in a while."
        action={
          <Button asChild>
            <Link href="/add">Add your first</Link>
          </Button>
        }
        className={className}
      />
    );
  }

  const inMemorization = progress.some((p) => p.itemId === item.id);
  const practicedToday = item.lastReviewedAt && new Date(item.lastReviewedAt).toDateString() === new Date().toDateString();

  return (
    <section aria-label="Today's dua" className={cn("paper-card", className)} data-testid="daily-card">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="p-5 sm:p-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <p>Today&apos;s dua · <TypeLabel item={item} className="text-sm" /></p>
            <VerificationBadge status={item.verification.status} compact />
          </div>
          <h2 className="mt-3 text-2xl font-medium sm:text-[1.75rem]">{item.title}</h2>
          {item.arabicText && <ArabicText size="xl" className="mt-6">{item.arabicText}</ArabicText>}
          {item.englishText && (
            <p className="mt-5 max-w-prose font-display text-[1.12rem] leading-relaxed text-foreground/90">{item.englishText}</p>
          )}
          {item.verification.referenceLabel && item.verification.status === "verified_match" && (
            <p className="mt-3 text-sm text-muted-foreground">{item.verification.referenceLabel}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-x-1 gap-y-2 border-t pt-4">
            <Button onClick={() => markPracticed(item)} disabled={!!practicedToday} className="mr-2">
              {practicedToday ? (
                <>
                  <Check /> Read today
                </>
              ) : (
                "Mark as read"
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggleFavorite(item)} aria-pressed={item.isFavorite}>
              <Heart className={cn(item.isFavorite && "fill-current")} />
              {item.isFavorite ? "Favorited" : "Favorite"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addToMemorization(item.id)} disabled={inMemorization}>
              {inMemorization ? "In memorization" : "Memorize"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/items/${item.id}`}>Open</Link>
            </Button>
            {items.length > 1 && (
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => setSkip((s) => s + 1)}>
                Show another
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
