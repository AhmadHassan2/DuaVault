import { normalizeArabic } from "../text/arabic";
import { normalizeEnglish } from "../text/english";

export interface Fingerprintable {
  arabicText: string;
  englishText: string;
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  similarity: number;
}

function charTrigrams(text: string): Set<string> {
  const s = text.replace(/\s+/g, " ");
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface Fingerprint {
  ar: Set<string>;
  en: Set<string>;
}

export function fingerprint(item: Fingerprintable): Fingerprint {
  return {
    ar: charTrigrams(normalizeArabic(item.arabicText)),
    en: charTrigrams(normalizeEnglish(item.englishText)),
  };
}

/**
 * Similarity 0..1. Arabic dominates when both sides have Arabic, since
 * translations of the same dua vary a lot between posts.
 */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  const hasAr = a.ar.size > 0 && b.ar.size > 0;
  const hasEn = a.en.size > 0 && b.en.size > 0;
  if (hasAr && hasEn) return Math.max(jaccard(a.ar, b.ar), 0.75 * jaccard(a.ar, b.ar) + 0.25 * jaccard(a.en, b.en));
  if (hasAr) return jaccard(a.ar, b.ar);
  if (hasEn) return jaccard(a.en, b.en);
  return 0;
}

export const DUPLICATE_THRESHOLD = 0.72;
export const SIMILAR_THRESHOLD = 0.5;

export function findDuplicates<T extends Fingerprintable & { id: string; title: string }>(
  candidate: Fingerprintable,
  existing: T[],
  threshold = SIMILAR_THRESHOLD,
): DuplicateCandidate[] {
  const fp = fingerprint(candidate);
  if (!fp.ar.size && !fp.en.size) return [];
  return existing
    .map((item) => ({ id: item.id, title: item.title, similarity: similarity(fp, fingerprint(item)) }))
    .filter((d) => d.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((d) => ({ ...d, similarity: Math.round(d.similarity * 100) / 100 }));
}
