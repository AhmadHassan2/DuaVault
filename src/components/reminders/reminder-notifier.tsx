"use client";

import { useEffect } from "react";
import { dueReminders, SLOT_DEFAULTS, slotForTime } from "@/core/schedule/reminders";
import { dateKey } from "@/core/schedule/daily";
import { getRepository } from "@/lib/data/repository";
import { notificationsSupported } from "@/lib/reminders";

const KEY = "duavault-notified";

function alreadyNotified(id: string, day: string): boolean {
  try {
    return localStorage.getItem(`${KEY}:${day}:${id}`) === "1";
  } catch {
    return false;
  }
}

function markNotified(id: string, day: string) {
  try {
    localStorage.setItem(`${KEY}:${day}:${id}`, "1");
  } catch {
    // storage unavailable — at worst the notification repeats
  }
}

/**
 * While DuaVault is open (tab or installed app), shows a system notification
 * when an item's daily reminder time arrives. Background delivery with the app
 * closed needs push, so the calendar export covers that case.
 */
export function ReminderNotifier() {
  useEffect(() => {
    if (!notificationsSupported()) return;
    const check = async () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const day = dateKey(now);
      const due = dueReminders(await getRepository().listItems(), now).filter((i) => !alreadyNotified(i.id, day));
      if (!due.length) return;
      const slot = slotForTime(due[0].reminderTime!);
      const title = SLOT_DEFAULTS[slot].heading;
      const body = due.length === 1 ? due[0].title : `${due[0].title} and ${due.length - 1} more`;
      const url = due.length === 1 ? `/items/${due[0].id}` : "/home";
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", tag: `duavault-${slot}-${day}`, data: { url } });
      else new Notification(title, { body, icon: "/icons/icon-192.png", tag: `duavault-${slot}-${day}` });
      due.forEach((i) => markNotified(i.id, day));
    };
    void check();
    const timer = setInterval(() => void check(), 60_000);
    return () => clearInterval(timer);
  }, []);
  return null;
}
