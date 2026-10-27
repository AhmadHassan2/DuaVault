import type { ContentType, SavedItem } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const DAILY_TYPES: ContentType[] = ["dua", "adhkar", "quran", "hadith", "reminder"];

/** Local calendar date key, e.g. "2026-10-25". */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyWeightBreakdown {
  item: SavedItem;
  weight: number;
}

/**
 * Weight favours content the user hasn't revisited for a while, never-revisited
 * content, and adhkar that suit the time of day.
 */
export function dailyWeight(item: SavedItem, now: Date): number {
  const last = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : null;
  const created = new Date(item.createdAt).getTime();
  const daysSince = Math.min(30, Math.max(0, (now.getTime() - (last ?? created)) / DAY));
  let w = 1 + daysSince * 0.25;
  if (last === null) w += 3;
  if (item.isFavorite) w += 0.5;
  if (last !== null && now.getTime() - last < DAY) w *= 0.05; // already seen today

  if (item.contentType === "adhkar") {
    const hour = now.getHours();
    const morning = hour >= 4 && hour < 12;
    const evening = hour >= 15 && hour < 23;
    if (item.subcategory === "morning") w *= morning ? 2 : 0.3;
    if (item.subcategory === "evening") w *= evening ? 2 : 0.3;
    if (item.subcategory === "sleep") w *= hour >= 20 || hour < 2 ? 2 : 0.4;
  }
  return w;
}

/**
 * Picks today's item. Deterministic for a given day and `skip` count, so the
 * daily item doesn't change on every page load but "show another" works.
 */
export function pickDailyItem(items: SavedItem[], now: Date = new Date(), skip = 0, seed = ""): SavedItem | null {
  const pool = items.filter((i) => DAILY_TYPES.includes(i.contentType));
  if (!pool.length) return null;
  const rand = mulberry32(hashString(`${seed}|${dateKey(now)}`));
  // Use a stable ordering so the result doesn't depend on storage order.
  const remaining = [...pool].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({ item, weight: dailyWeight(item, now) }));
  let picked: SavedItem | null = null;
  for (let round = 0; round <= skip % pool.length; round++) {
    const total = remaining.reduce((s, r) => s + r.weight, 0);
    let x = rand() * total;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      x -= remaining[i].weight;
      if (x <= 0) {
        idx = i;
        break;
      }
    }
    picked = remaining[idx].item;
    remaining.splice(idx, 1);
  }
  return picked;
}

/** Items not opened/practiced since they were saved, oldest first. */
export function neverRevisited(items: SavedItem[]): SavedItem[] {
  return items.filter((i) => !i.lastReviewedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
