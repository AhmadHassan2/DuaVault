"use client";

import Link from "next/link";
import { Bell, Lock, NotebookPen, Plus } from "lucide-react";
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
        title="Your dua journal"
        description="Personal duas and reflections, kept separate from Quran and hadith and visible only to you."
        actions={
          <Button asChild>
            <Link href="/journal/new">
              <Plus /> New entry
            </Link>
          </Button>
        }
      />
      <p className="mb-6 flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Journal entries are never shared, never used for verification and never mixed into your library.
      </p>
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
              <Link href={`/journal/${e.id}`} className="paper-card block p-5 transition-transform hover:-translate-y-0.5">
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
    </div>
  );
}
