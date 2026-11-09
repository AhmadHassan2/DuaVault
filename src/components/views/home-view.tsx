"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus, Search, Sprout, NotebookPen, FolderHeart, BookOpen } from "lucide-react";
import { neverRevisited } from "@/core/schedule/daily";
import { progressSummary, reviewQueue } from "@/core/schedule/srs";
import { useCollections, useItems, usePractice, useProgress } from "@/lib/data/hooks";
import { greeting } from "@/lib/format";
import { DailyCard } from "@/components/practice/daily-card";
import { DueRemindersCard } from "@/components/reminders/due-reminders-card";
import { ItemCard, ItemCardSkeleton } from "@/components/items/item-card";
import { SectionHeading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const dateFormat = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" });

export function HomeView() {
  const items = useItems();
  const progress = useProgress();
  const practice = usePractice();
  const collections = useCollections();
  const [now] = useState(() => Date.now());
  const [shelf, setShelf] = useState<"recent" | "favorites">("recent");
  const loading = items.loading || progress.loading;
  const all = items.data ?? [];
  const prog = progress.data ?? [];
  const due = reviewQueue(prog);
  const summary = progressSummary(prog);
  const unread = neverRevisited(all);
  const practicedThisWeek = (practice.data ?? []).filter((p) => p.kind !== "viewed" && now - new Date(p.at).getTime() < WEEK).length;
  const shelfItems = (shelf === "favorites" ? all.filter((i) => i.isFavorite) : all).slice(0, 4);

  return (
    <div className="space-y-12">
      <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <header className="py-2 lg:py-6">
          <p className="eyebrow">{greeting(new Date(now))}</p>
          <p className="mt-1 text-sm text-muted-foreground">{dateFormat.format(now)}</p>
          <h1 className="mt-6 max-w-md text-5xl leading-[1.08] font-medium text-balance sm:text-6xl">As-salamu alaykum.<br /><span className="text-primary italic">Continue your daily dhikr.</span></h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">Read your saved duas, review your memorization and record your personal supplications.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild><Link href="/add"><Plus aria-hidden="true" /> Save a reminder</Link></Button>
            <Button asChild variant="outline"><Link href="/find"><Search aria-hidden="true" /> Find a dua</Link></Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t pt-5 text-sm text-muted-foreground">
            <span><strong className="mr-1 text-foreground">{loading ? "—" : all.length}</strong> saved</span>
            <span><strong className="mr-1 text-foreground">{loading ? "—" : practicedThisWeek}</strong> practices this week</span>
            <span><strong className="mr-1 text-foreground">{loading ? "—" : summary.memorized}</strong> memorized</span>
          </div>
        </header>
        <section className="relative min-w-0">
          <p className="eyebrow mb-4 flex items-center gap-2"><span className="size-1.5 rounded-full bg-sage" /> Today’s reading</p>
          {loading ? <div className="paper-card h-80 animate-pulse" /> : <DailyCard items={all} progress={prog} />}
          {summary.total > 0 && <Link href="/practice/memorize" className="mt-3 flex items-center justify-between gap-3 rounded-xl border bg-secondary/30 px-5 py-4 text-sm text-secondary-foreground"><span className="flex items-center gap-2"><Sprout aria-hidden="true" className="size-4" />{due.length ? `${due.length} cards ready for review` : "Review your memorization"}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>}
        </section>
      </div>

      {!loading && <DueRemindersCard items={all} now={new Date(now)} />}

      <div className="grid items-start gap-10 border-t pt-10 lg:grid-cols-[1fr_20rem] xl:gap-14">
        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-3xl font-medium">Your library</h2>
            <div className="flex gap-1 rounded-full border p-1" role="group" aria-label="Shelf filter">
              {(["recent", "favorites"] as const).map((value) => <button key={value} type="button" aria-pressed={shelf === value} onClick={() => setShelf(value)} className={cn("min-h-10 rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", shelf === value ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}>{value === "recent" ? "Recently saved" : "Favorites"}</button>)}
            </div>
          </div>
          {loading ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <ItemCardSkeleton key={i} />)}</div> : shelfItems.length ? (
            <div className="grid gap-4 sm:grid-cols-2">{shelfItems.map((item) => <ItemCard key={item.id} item={item} memorization={prog.find((p) => p.itemId === item.id)?.state} />)}</div>
          ) : (
            <div className="flex min-h-56 flex-col items-start justify-center rounded-2xl border border-dashed p-7">
              <BookOpen aria-hidden="true" className="mb-4 size-7 text-primary" />
              <h3 className="text-2xl">{shelf === "favorites" ? "Your favorite duas and reminders" : "Your library is waiting"}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{shelf === "favorites" ? "Tap the heart on a saved item to find it here." : "Start with a screenshot, a verse or a reminder you want to return to."}</p>
              <Link href={shelf === "favorites" ? "/library" : "/add"} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">{shelf === "favorites" ? "Browse your library" : "Add your first item"}<ArrowRight aria-hidden="true" className="size-4" /></Link>
            </div>
          )}
          {all.length > 0 && <Link href="/library" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-primary">Open your library <ArrowRight aria-hidden="true" className="size-4" /></Link>}
          {unread.length > 0 && <div className="mt-8"><SectionHeading title="Saved items to revisit" /><ul className="divide-y">{unread.slice(0, 3).map((item) => <li key={item.id}><Link href={`/items/${item.id}`} className="flex items-center justify-between gap-3 py-4 text-sm hover:text-primary"><span className="truncate">{item.title}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>)}</ul></div>}
        </section>
        <aside className="space-y-7">
          <Link href="/journal/new" className="sanctuary-panel interactive-card block p-6"><NotebookPen aria-hidden="true" className="mb-5 size-6 text-primary" /><p className="eyebrow">Your personal duas</p><h2 className="mt-2 text-3xl leading-tight">Record your supplications</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Write your duas to Allah and reflect on His blessings.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">Open your journal <ArrowRight aria-hidden="true" className="size-4" /></span></Link>
          <section><SectionHeading title="Your collections" action={<Link href="/collections" aria-label="Manage collections" className="flex size-11 items-center justify-center rounded-full border text-primary"><Plus aria-hidden="true" className="size-4" /></Link>} />
            <div className="space-y-2">{(collections.data ?? []).slice(0, 4).map((c) => <Link key={c.id} href={`/collections/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"><FolderHeart aria-hidden="true" className="size-5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-sm">{c.name}</span><span className="text-xs text-muted-foreground">{c.itemIds.length}</span></Link>)}</div>
            {!collections.data?.length && <p className="text-sm leading-relaxed text-muted-foreground">Organize duas by topic, occasion or person. <Link href="/collections" className="text-primary hover:underline">Make your first collection.</Link></p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
