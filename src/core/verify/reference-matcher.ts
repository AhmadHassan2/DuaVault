import type { ReferenceEntry } from "../types";
import { arabicTokens, normalizeArabic } from "../text/arabic";
import { ShingleIndex, overlap, shingles, shingleSize } from "./shingle-index";

export interface ReferenceMatch {
  kind: "exact" | "partial" | "possible";
  entry: ReferenceEntry;
  score: number;
}

/** Matches text against imported hadith / dua / dhikr reference records. */
export class ReferenceEntryMatcher {
  private readonly normalized: string[];
  private readonly tokens: string[][];
  private readonly indexes = new Map<number, ShingleIndex>();

  constructor(readonly entries: ReferenceEntry[]) {
    this.normalized = entries.map((e) => normalizeArabic(e.arabic));
    this.tokens = this.normalized.map((n) => (n ? n.split(" ") : []));
  }

  get size(): number {
    return this.entries.length;
  }

  private index(n: number): ShingleIndex {
    let idx = this.indexes.get(n);
    if (!idx) {
      idx = new ShingleIndex(this.tokens, n);
      this.indexes.set(n, idx);
    }
    return idx;
  }

  match(arabic: string): ReferenceMatch | null {
    const qTokens = arabicTokens(arabic);
    if (qTokens.length < 2 || !this.entries.length) return null;
    const q = qTokens.join(" ");
    const n = shingleSize(qTokens.length);
    const qShingles = shingles(qTokens, n);
    const idx = this.index(n);
    let best: ReferenceMatch | null = null;
    for (const { index } of idx.candidates(qShingles, 10)) {
      const target = this.normalized[index];
      let result: ReferenceMatch;
      if (target === q) result = { kind: "exact", entry: this.entries[index], score: 1 };
      else if (qTokens.length >= 3 && target.includes(q)) {
        result = { kind: "partial", entry: this.entries[index], score: 1 };
      } else {
        const o = overlap(qShingles, idx.entryShingles[index]);
        result = { kind: "possible", entry: this.entries[index], score: o.dice };
      }
      if (!best || result.score > best.score) best = result;
    }
    if (!best || best.score < 0.45) return null;
    return best;
  }
}
