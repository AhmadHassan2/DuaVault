"use client";

import Link from "next/link";
import { Check, Moon, Sun, Sunset } from "lucide-react";
import type { SavedItem } from "@/core/types";
import { SLOT_DEFAULTS, dueReminders, slotForTime } from "@/core/schedule/reminders";
import { Button } from "@/components/ui/button";
import { markPracticed } from "@/lib/actions";

const ICONS = { morning: Sun, evening: Sunset, sleep: Moon } as const;

/** "It's morning — here are your morning adhkar." Shown only while something is due. */
export function DueRemindersCard({ items, now }: { items: SavedItem[]; now: Date }) {
  const due = dueReminders(items, now);
  if (!due.length) return null;
  const slot = slotForTime(due[0].reminderTime!);
  const Icon = ICONS[slot];
  return (
    <section className="rounded-lg border border-gold/50 bg-gold-soft/50" data-testid="due-reminders" aria-label="Reminders due now">
      <div className="flex items-center gap-2 px-4 pt-3 text-sm">
        <Icon className="size-4 text-gold" />
        <h2 className="text-lg font-medium">{SLOT_DEFAULTS[slot].heading}</h2>
      </div>
      <ul className="mt-1 divide-y divide-gold/25">
        {due.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-2">
            <Link href={`/items/${item.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
              {item.title}
            </Link>
            <span className="text-xs text-muted-foreground tabular-nums">{item.reminderTime}</span>
            <Button size="sm" variant="ghost" onClick={() => markPracticed(item)}>
              <Check /> Done
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
