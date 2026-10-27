"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { neverRevisited } from "@/core/schedule/daily";
import { progressSummary, reviewQueue } from "@/core/schedule/srs";
import { useCollections, useItems, usePractice, useProgress } from "@/lib/data/hooks";
import { greeting } from "@/lib/format";
import { DailyCard } from "@/components/practice/daily-card";
import { QuickUpload } from "@/components/upload/quick-upload";
import { DueRemindersCard } from "@/components/reminders/due-reminders-card";
import { ItemCard, ItemCardSkeleton } from "@/components/items/item-card";
import { SectionHeading } from "@/components/common";

const WEEK = 7 * 24 * 60 * 60 * 1000;

const dateFormat = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" });

export function HomeView() {
  const items = useItems();
  const progress = useProgress();
  const practice = usePractice();
  const collections = useCollections();

  const [now] = useState(() => Date.now());
  const loading = items.loading || progress.loading;
  const all = items.data ?? [];
  const prog = progress.data ?? [];
  const due = reviewQueue(prog);
  const summary = progressSummary(prog);
  const unread = neverRevisited(all);
  const practicedThisWeek = (practice.data ?? []).filter(
    (p) => p.kind !== "viewed" && now - new Date(p.at).getTime() < WEEK,
  ).length;

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting(new Date(now))} · {dateFormat.format(now)}
          </p>
          <h1 className="mt-1 text-3xl font-medium sm:text-4xl">
            Welcome home <span className="text-gold">·</span> <span className="italic">as-salamu alaykum</span>
          </h1>
        </div>
        {all.length > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {all.length} saved · {practicedThisWeek} practiced this week · {summary.memorized} memorized
          </p>
        )}
      </header>

      {!loading && <DueRemindersCard items={all} now={new Date(now)} />}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_16rem]">
        {loading ? <div className="paper-card h-72 animate-pulse" /> : <DailyCard items={all} progress={prog} />}
        <aside className="space-y-6">
          <QuickUpload />
          {summary.total > 0 && (
            <div className="space-y-1.5 border-t pt-4 text-sm">
              <p className="font-medium">Memorization</p>
              <p className="text-muted-foreground">
                {due.length ? `${due.length} due for review` : "Nothing due right now"} · {summary.learning} learning ·{" "}
                {summary.familiar} familiar · {summary.memorized} memorized
              </p>
              <Link href="/practice/memorize" className="inline-flex items-center gap-1 text-primary hover:underline">
                {due.length ? "Review now" : "Open flashcards"} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
          <div className="space-y-1.5 border-t pt-4 text-sm">
            <p className="font-medium">Looking for something?</p>
            <Link href="/find" className="inline-flex items-center gap-1 text-primary hover:underline">
              Search by situation <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>

      <section>
        <SectionHeading
          title="Recently saved"
          action={
            all.length > 0 && (
              <Link href="/library" className="text-sm text-primary hover:underline">
                Library
              </Link>
            )
          }
        />
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : all.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {all.slice(0, 3).map((item) => (
              <ItemCard key={item.id} item={item} memorization={prog.find((p) => p.itemId === item.id)?.state} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
        )}
      </section>

      {unread.length > 0 && (
        <section>
          <SectionHeading
            title="Not opened since saving"
            action={
              <Link href="/library?filter=unrevisited" className="text-sm text-primary hover:underline">
                All {unread.length}
              </Link>
            }
          />
          <ul className="divide-y border-y">
            {unread.slice(0, 4).map((item) => (
              <li key={item.id}>
                <Link href={`/items/${item.id}`} className="flex items-center gap-3 py-2.5 text-[0.95rem] hover:text-primary">
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeading
          title="Collections"
          action={
            <Link href="/collections" className="text-sm text-primary hover:underline">
              Manage
            </Link>
          }
        />
        {(collections.data ?? []).length ? (
          <ul className="divide-y border-y">
            {(collections.data ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/collections/${c.id}`} className="flex items-center gap-3 py-2.5 text-[0.95rem] hover:text-primary">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{c.itemIds.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            None yet.{" "}
            <Link href="/collections" className="text-primary hover:underline">
              Create one
            </Link>{" "}
            for a person, an occasion or a season.
          </p>
        )}
      </section>
    </div>
  );
}
