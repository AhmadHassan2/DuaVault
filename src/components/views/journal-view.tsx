"use client";

import Link from "next/link";
import { ArrowUpRight, Bell, Lock, NotebookPen, Plus } from "lucide-react";
import { topicLabel } from "@/core/classify/topics";
import { useJournal } from "@/lib/data/hooks";
import { relativeTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";

export function JournalView() {
  const journal = useJournal();
  return (
    <div>
      <PageHeader
        eyebrow="Personal supplications"
        title="Your dua journal"
        description="Record your duas to Allah and your reflections on what you learn."
        actions={
          <Button asChild>
            <Link href="/journal/new">
              <Plus /> New entry
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-10 lg:grid-cols-[19rem_1fr] xl:gap-16">
      <aside className="lg:sticky lg:top-6">
        <p className="eyebrow mb-4">Suggested journal topics</p>
        <div className="sanctuary-panel p-6"><NotebookPen aria-hidden="true" className="mb-5 size-7 text-primary" /><h2 className="text-3xl leading-tight">Begin with a personal dua.</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Write a supplication or reflect on a blessing from Allah.</p><div className="mt-5 divide-y">{["Blessings I am grateful to Allah for", "Dua for my family", "What I am asking Allah for"].map((prompt)=><Link key={prompt} href={`/journal/new?prompt=${encodeURIComponent(prompt)}`} className="flex min-h-14 items-center justify-between gap-3 py-3 text-sm text-primary">{prompt}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></Link>)}</div></div>
      <p className="mt-5 flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> Your personal reflections stay separate from Quran and hadith, and private to you.
      </p>
      </aside>
      <section className="min-w-0" aria-label="Journal entries">
      <div className="mb-5 flex items-center justify-between border-b pb-4"><h2 className="text-2xl">Journal entries</h2><span className="text-sm text-muted-foreground">{journal.loading ? "Opening…" : `${journal.data?.length ?? 0} reflections`}</span></div>
      {journal.loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="paper-card h-24 animate-pulse" />
          ))}
        </div>
      ) : journal.data?.length ? (
        <ul className="space-y-3">
          {journal.data.map((e) => (
            <li key={e.id}>
              <Link href={`/journal/${e.id}`} className="paper-card interactive-card block border-l-4 border-l-primary/50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="truncate text-lg font-medium">{e.title || "Untitled reflection"}</h2>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(e.updatedAt)}</span>
                </div>
                {e.body && <p className="mt-1.5 line-clamp-2 font-display text-[1.02rem] text-muted-foreground italic">{e.body}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {e.topic && <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{topicLabel(e.topic)}</span>}
                  {e.reminderEnabled && e.reminderTime && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Bell className="size-3" /> {e.reminderTime}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={NotebookPen}
          title="No entries yet"
          description="Write the duas you make in your own words, or notes on something you read."
          action={
            <Button asChild>
              <Link href="/journal/new">Write your first entry</Link>
            </Button>
          }
        />
      )}
      </section>
      </div>
    </div>
  );
}
