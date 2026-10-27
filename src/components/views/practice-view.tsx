"use client";

import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { progressSummary, reviewQueue } from "@/core/schedule/srs";
import { neverRevisited } from "@/core/schedule/daily";
import { useItems, usePractice, useProgress } from "@/lib/data/hooks";
import { relativeTime } from "@/lib/format";
import { PageHeader, SectionHeading, Stat } from "@/components/common";
import { DailyCard } from "@/components/practice/daily-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function PracticeView() {
  const items = useItems();
  const progress = useProgress();
  const practice = usePractice();
  const all = items.data ?? [];
  const prog = progress.data ?? [];
  const summary = progressSummary(prog);
  const due = reviewQueue(prog);
  const byId = new Map(all.map((i) => [i.id, i]));
  const recent = (practice.data ?? []).filter((p) => p.kind !== "viewed").slice(0, 8);
  const unread = neverRevisited(all);

  return (
    <div className="space-y-10">
      <PageHeader title="Practice" description="Today's dua, and the cards you're memorizing." />

      {items.loading ? <div className="paper-card h-72 animate-pulse" /> : <DailyCard items={all} progress={prog} />}

      <section className="paper-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-medium">Memorization</h2>
            <p className="text-sm text-muted-foreground">
              {summary.total
                ? due.length
                  ? `${due.length} ready to review`
                  : "All caught up — your next cards will be ready soon."
                : "Add duas to your memorization list from any item."}
            </p>
          </div>
          <Button asChild disabled={!summary.total}>
            <Link href="/practice/memorize">
              {due.length ? "Start review" : "Open flashcards"} <ArrowRight />
            </Link>
          </Button>
        </div>
        {summary.total > 0 && (
          <div className="mt-5 space-y-3">
            <Progress value={(summary.memorized / summary.total) * 100} aria-label="Memorized share" />
            <div className="grid grid-cols-3 gap-2">
              <Stat value={summary.learning} label="learning" />
              <Stat value={summary.familiar} label="familiar" />
              <Stat value={summary.memorized} label="memorized" />
            </div>
          </div>
        )}
      </section>

      {unread.length > 0 && (
        <section>
          <SectionHeading title="Haven't opened since saving" />
          <div className="flex flex-wrap gap-2">
            {unread.slice(0, 8).map((i) => (
              <Link key={i.id} href={`/items/${i.id}`} className="rounded-md border px-3 py-1.5 text-sm hover:border-foreground/25">
                {i.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading title="Recent practice" />
        {recent.length ? (
          <ul className="divide-y border-y">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <History className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {p.kind === "memorization_review" ? `Reviewed — ${p.rating}` : "Practiced"} · {byId.get(p.itemId)?.title ?? "Deleted item"}
                </span>
                <span className="text-xs text-muted-foreground">{relativeTime(p.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Items you mark as read or review will be listed here.</p>
        )}
      </section>
    </div>
  );
}
