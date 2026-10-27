"use client";

import type { SavedItem } from "@/core/types";
import { buildReminderCalendar } from "@/core/schedule/reminders";

/** Downloads a .ics file with daily repeating reminders — works with the app closed. */
export function downloadReminderCalendar(items: SavedItem[], fileName = "duavault-reminders.ics"): void {
  const ics = buildReminderCalendar(items, window.location.origin);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
