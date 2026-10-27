"use client";

import { Bell, CalendarPlus } from "lucide-react";
import { SLOT_DEFAULTS, slotForTime } from "@/core/schedule/reminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { requestNotificationPermission } from "@/lib/reminders";

/**
 * Daily reminder toggle. `suggested` is the time inferred from the content
 * (e.g. 07:00 for morning adhkar) and is used when switching on.
 */
export function ReminderControl({
  value,
  suggested,
  onChange,
  onAddToCalendar,
  idPrefix,
}: {
  value: string | null;
  suggested: string | null;
  onChange: (time: string | null) => void;
  onAddToCalendar?: () => void;
  idPrefix: string;
}) {
  const on = value !== null;
  const slot = slotForTime(value ?? suggested ?? "07:00");
  return (
    <div className="space-y-2 rounded-md border bg-card px-4 py-3" data-testid="reminder-control">
      <div className="flex flex-wrap items-center gap-3">
        <Bell className="size-4 text-gold" />
        <label htmlFor={`${idPrefix}-reminder`} className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{on ? `Remind me ${SLOT_DEFAULTS[slot].label.toLowerCase()}` : "Daily reminder"}</span>
          {!on && suggested && (
            <span className="block text-xs text-muted-foreground">
              Looks like a {slot === "sleep" ? "before-sleep" : slot} dua — remind you at {suggested}?
            </span>
          )}
        </label>
        {on && (
          <Input
            type="time"
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="h-8 w-[7.5rem]"
            aria-label="Reminder time"
          />
        )}
        <Switch
          id={`${idPrefix}-reminder`}
          checked={on}
          onCheckedChange={(checked) => {
            if (checked) void requestNotificationPermission();
            onChange(checked ? (suggested ?? "07:00") : null);
          }}
        />
      </div>
      {on && onAddToCalendar && (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          <Button size="sm" variant="secondary" onClick={onAddToCalendar}>
            <CalendarPlus /> Add to my calendar
          </Button>
          <span className="text-xs text-muted-foreground">Repeats daily — reminds you even when DuaVault is closed.</span>
        </div>
      )}
    </div>
  );
}
