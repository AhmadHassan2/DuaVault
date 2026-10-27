import type { SavedItem } from "../types";
import { dateKey } from "./daily";

export type ReminderSlot = "morning" | "evening" | "sleep";

export const SLOT_DEFAULTS: Record<ReminderSlot, { time: string; label: string; heading: string }> = {
  morning: { time: "07:00", label: "Every morning", heading: "Morning adhkar time" },
  evening: { time: "17:30", label: "Every evening", heading: "Evening adhkar time" },
  sleep: { time: "22:00", label: "Before sleep", heading: "Before you sleep" },
};

/** How long after the reminder time an item keeps showing as "due now". */
export const REMINDER_WINDOW_MINUTES = 4 * 60;

/** Detects whether content is tied to a time of day (morning/evening adhkar, duas before sleep). */
export function reminderSlotFor(item: Pick<SavedItem, "contentType" | "subcategory" | "tags">): ReminderSlot | null {
  if (item.contentType === "adhkar") {
    if (item.subcategory === "morning") return "morning";
    if (item.subcategory === "evening") return "evening";
    if (item.subcategory === "sleep") return "sleep";
  }
  const tags = new Set(item.tags);
  if (tags.has("morning") && !tags.has("evening")) return "morning";
  if (tags.has("evening") && !tags.has("morning")) return "evening";
  if (tags.has("sleep")) return "sleep";
  return null;
}

export function suggestedReminderTime(item: Pick<SavedItem, "contentType" | "subcategory" | "tags">): string | null {
  const slot = reminderSlotFor(item);
  return slot ? SLOT_DEFAULTS[slot].time : null;
}

export function slotForTime(time: string): ReminderSlot {
  const [h] = time.split(":").map(Number);
  if (h >= 3 && h < 12) return "morning";
  if (h >= 12 && h < 20) return "evening";
  return "sleep";
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Items whose reminder time has passed (within the window) and that haven't
 * been opened or practiced since. Sorted by reminder time.
 */
export function dueReminders(items: SavedItem[], now: Date = new Date()): SavedItem[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return items
    .filter((i) => {
      if (!i.reminderTime) return false;
      // Minutes since the most recent occurrence (may be yesterday, e.g. 22:00 → 01:00).
      const since = (nowMin - minutesOf(i.reminderTime) + 24 * 60) % (24 * 60);
      if (since > REMINDER_WINDOW_MINUTES) return false;
      const windowStart = now.getTime() - since * 60_000;
      return !i.lastReviewedAt || new Date(i.lastReviewedAt).getTime() < windowStart;
    })
    .sort((a, b) => minutesOf(a.reminderTime!) - minutesOf(b.reminderTime!));
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(d: Date, time: string): string {
  const [h, m] = time.split(":");
  return `${dateKey(d).replace(/-/g, "")}T${h.padStart(2, "0")}${(m ?? "00").padStart(2, "0")}00`;
}

/**
 * A calendar file with one daily repeating event (and alert) per item. Times
 * are "floating" local times, so they follow the phone's time zone.
 */
export function buildReminderCalendar(items: SavedItem[], appUrl: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const events = items
    .filter((i) => i.reminderTime)
    .map((i) => {
      const description = [i.englishText, `Open in DuaVault: ${appUrl}/items/${i.id}`].filter(Boolean).join("\n\n");
      return [
        "BEGIN:VEVENT",
        `UID:duavault-${i.id}@duavault`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(now, i.reminderTime!)}`,
        "DURATION:PT10M",
        "RRULE:FREQ=DAILY",
        `SUMMARY:${icsEscape(`🤲 ${i.title}`)}`,
        `DESCRIPTION:${icsEscape(description)}`,
        `URL:${appUrl}/items/${i.id}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(i.title)}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DuaVault//Reminders//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}
