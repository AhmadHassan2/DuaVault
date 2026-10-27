import type { MemorizationProgress, MemorizationState } from "../types";

const DAY = 24 * 60 * 60 * 1000;
export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

export type MemorizationRating = Exclude<MemorizationState, "not_started">;

export function newProgress(itemId: string, now: Date = new Date()): MemorizationProgress {
  return {
    itemId,
    state: "learning",
    ease: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueAt: now.toISOString(),
    lastReviewedAt: null,
  };
}

/**
 * A small SM-2 variant driven by the three self-assessments shown in the UI.
 * The user's own rating becomes the item's state; the rating also decides
 * when the card is next due.
 */
export function review(progress: MemorizationProgress, rating: MemorizationRating, now: Date = new Date()): MemorizationProgress {
  let { ease, intervalDays, repetitions } = progress;

  switch (rating) {
    case "learning":
      ease = Math.max(MIN_EASE, ease - 0.2);
      repetitions = 0;
      intervalDays = 1;
      break;
    case "familiar":
      repetitions += 1;
      intervalDays = repetitions === 1 ? 2 : Math.max(3, Math.round(Math.max(intervalDays, 1) * ease * 0.8));
      ease = Math.max(MIN_EASE, ease - 0.05);
      break;
    case "memorized":
      repetitions += 1;
      intervalDays = repetitions === 1 ? 4 : Math.max(7, Math.round(Math.max(intervalDays, 1) * ease));
      ease = Math.min(3.2, ease + 0.1);
      break;
  }

  return {
    ...progress,
    state: rating,
    ease: Math.round(ease * 100) / 100,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export function isDue(progress: MemorizationProgress, now: Date = new Date()): boolean {
  return new Date(progress.dueAt).getTime() <= now.getTime();
}

/** Due cards first (oldest due first), learning before familiar before memorized. */
export function reviewQueue(progress: MemorizationProgress[], now: Date = new Date()): MemorizationProgress[] {
  const order: Record<MemorizationState, number> = { learning: 0, not_started: 0, familiar: 1, memorized: 2 };
  return progress
    .filter((p) => isDue(p, now))
    .sort((a, b) => order[a.state] - order[b.state] || a.dueAt.localeCompare(b.dueAt));
}

export function progressSummary(progress: MemorizationProgress[]) {
  return {
    learning: progress.filter((p) => p.state === "learning").length,
    familiar: progress.filter((p) => p.state === "familiar").length,
    memorized: progress.filter((p) => p.state === "memorized").length,
    total: progress.length,
  };
}
