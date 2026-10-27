import { arabicTokens, normalizeArabic } from "../text/arabic";
import { englishTokens } from "../text/english";
import { ShingleIndex, overlap, shingles, shingleSize } from "./shingle-index";

/** One ayah from a trusted Quran dataset. */
export interface QuranVerse {
  surah: number;
  ayah: number;
  /** Display text exactly as provided by the dataset. */
  text: string;
  /** Optional plain-spelling text from the same dataset, used for matching. */
  matchText?: string;
  /** Translation exactly as provided by the dataset, if any. */
  translation?: string;
}

export interface QuranDataset {
  sourceName: string;
  translationName?: string;
  licence: string;
  verses: QuranVerse[];
  /** Surah names as provided by the dataset (index 0 = surah 1). */
  surahNames?: string[];
}

export interface QuranMatch {
  kind: "exact" | "partial" | "possible";
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  /** Dataset text for the matched span (verbatim). */
  text: string;
  translation?: string;
  label: string;
  /** Textual similarity 0..1. Not an authenticity score. */
  score: number;
}

const MAX_SPAN = 12;
const MIN_QUERY_TOKENS = 3;

export class QuranMatcher {
  /** Normalized match text (plain spelling when available). */
  private readonly normalized: string[];
  /** Normalized display text — differs for Uthmani orthography. */
  private readonly normalizedDisplay: string[];
  private readonly tokens: string[][];
  private readonly indexes = new Map<number, ShingleIndex>();

  constructor(readonly dataset: QuranDataset) {
    this.normalized = dataset.verses.map((v) => normalizeArabic(v.matchText ?? v.text));
    this.normalizedDisplay = dataset.verses.map((v) => (v.matchText ? normalizeArabic(v.text) : ""));
    this.tokens = this.normalized.map((n) => (n ? n.split(" ") : []));
  }

  /** Whether the query appears verbatim (after normalization) in the span, in either orthography. */
  private textRelation(q: string, start: number, end: number): "exact" | "partial" | null {
    const spans = [this.normalized.slice(start, end + 1).join(" ")];
    if (this.normalizedDisplay[start]) spans.push(this.normalizedDisplay.slice(start, end + 1).join(" "));
    if (spans.some((s) => s === q)) return "exact";
    if (q.split(" ").length >= MIN_QUERY_TOKENS && spans.some((s) => s.includes(q))) return "partial";
    return null;
  }

  private index(n: number): ShingleIndex {
    let idx = this.indexes.get(n);
    if (!idx) {
      idx = new ShingleIndex(this.tokens, n);
      this.indexes.set(n, idx);
    }
    return idx;
  }

  label(surah: number, ayahStart: number, ayahEnd = ayahStart): string {
    const name = this.dataset.surahNames?.[surah - 1];
    const range = ayahEnd !== ayahStart ? `${ayahStart}-${ayahEnd}` : `${ayahStart}`;
    return name ? `Surah ${name} ${surah}:${range}` : `Quran ${surah}:${range}`;
  }

  private findIndex(surah: number, ayah: number): number {
    return this.dataset.verses.findIndex((v) => v.surah === surah && v.ayah === ayah);
  }

  getSpan(surah: number, ayahStart: number, ayahEnd = ayahStart): QuranVerse[] {
    const start = this.findIndex(surah, ayahStart);
    if (start === -1) return [];
    const out: QuranVerse[] = [];
    for (let i = start; i < this.dataset.verses.length; i++) {
      const v = this.dataset.verses[i];
      if (v.surah !== surah || v.ayah > ayahEnd) break;
      out.push(v);
    }
    return out;
  }

  private spanResult(start: number, end: number, kind: QuranMatch["kind"], score: number): QuranMatch {
    const verses = this.dataset.verses.slice(start, end + 1);
    const first = verses[0];
    const last = verses[verses.length - 1];
    const translations = verses.map((v) => v.translation).filter(Boolean);
    return {
      kind,
      surah: first.surah,
      ayahStart: first.ayah,
      ayahEnd: last.ayah,
      text: verses.map((v) => v.text).join(" "),
      translation: translations.length ? translations.join(" ") : undefined,
      label: this.label(first.surah, first.ayah, last.ayah),
      score,
    };
  }

  /**
   * Compares text against a specific claimed reference. Returns how well the
   * text matches the dataset wording of that reference.
   */
  compareWithReference(arabic: string, surah: number, ayahStart: number, ayahEnd = ayahStart): QuranMatch | null {
    const start = this.findIndex(surah, ayahStart);
    if (start === -1) return null;
    let end = start;
    while (
      end + 1 < this.dataset.verses.length &&
      this.dataset.verses[end + 1].surah === surah &&
      this.dataset.verses[end + 1].ayah <= ayahEnd
    ) {
      end++;
    }
    return this.scoreSpan(arabic, start, end);
  }

  private scoreSpan(arabic: string, start: number, end: number): QuranMatch {
    const q = normalizeArabic(arabic);
    const span = this.normalized.slice(start, end + 1).join(" ");
    const relation = q ? this.textRelation(q, start, end) : null;
    if (relation) return this.spanResult(start, end, relation, 1);
    const qTokens = q ? q.split(" ") : [];
    const n = shingleSize(qTokens.length);
    const o = overlap(shingles(qTokens, n), shingles(span.split(" "), n));
    return this.spanResult(start, end, "possible", Math.max(o.dice, o.containment * 0.9));
  }

  /** Searches the whole Quran for the best matching span. */
  match(arabic: string): QuranMatch | null {
    const qTokens = arabicTokens(arabic);
    if (qTokens.length < MIN_QUERY_TOKENS) return null;
    const q = qTokens.join(" ");
    const n = shingleSize(qTokens.length);
    const qShingles = shingles(qTokens, n);
    const idx = this.index(n);
    const candidates = idx.candidates(qShingles, 15);
    if (!candidates.length) return null;

    const best = this.bestSpan(qShingles, candidates, this.tokens, idx, n);
    if (!best || best.containment < 0.35) return null;

    const relation = this.textRelation(q, best.start, best.end);
    if (relation) return this.spanResult(best.start, best.end, relation, 1);
    return this.spanResult(best.start, best.end, "possible", Math.max(best.dice, best.containment * 0.9));
  }

  /** Greedily grows each candidate verse into the contiguous span that best explains the query. */
  private bestSpan(
    qShingles: string[],
    candidates: Array<{ index: number }>,
    tokens: string[][],
    idx: ShingleIndex,
    n: number,
  ): { start: number; end: number; containment: number; dice: number; coverage: number } | null {
    let best: { start: number; end: number; containment: number; dice: number; coverage: number } | null = null;
    const sameSurah = (a: number, b: number) => this.dataset.verses[a].surah === this.dataset.verses[b].surah;
    for (const { index } of candidates) {
      let start = index;
      let end = index;
      let cur = overlap(qShingles, idx.entryShingles[index]);
      for (let step = 0; step < MAX_SPAN; step++) {
        const options: Array<[number, number]> = [];
        if (end + 1 < tokens.length && sameSurah(end + 1, start)) options.push([start, end + 1]);
        if (start - 1 >= 0 && sameSurah(start - 1, start)) options.push([start - 1, end]);
        let improved = false;
        for (const [s, e] of options) {
          const o = overlap(qShingles, shingles(tokens.slice(s, e + 1).flat(), n));
          if (o.containment > cur.containment + 0.02) {
            start = s;
            end = e;
            cur = o;
            improved = true;
            break;
          }
        }
        if (!improved) break;
      }
      if (
        !best ||
        cur.containment > best.containment + 1e-9 ||
        (Math.abs(cur.containment - best.containment) < 1e-9 && cur.dice > best.dice)
      ) {
        best = { start, end, ...cur };
      }
    }
    return best;
  }

  private translationTokens: string[][] | null = null;
  private translationIndex: ShingleIndex | null = null;

  /**
   * Finds the verse span whose dataset translation matches English text.
   * Used only to suggest the dataset wording when the Arabic is unreadable —
   * a translation match is never treated as verification of the Arabic.
   */
  matchTranslation(english: string): QuranMatch | null {
    if (!this.dataset.verses.some((v) => v.translation)) return null;
    const q = englishTokens(english, { keepStopwords: true });
    if (q.length < 8) return null;
    this.translationTokens ??= this.dataset.verses.map((v) => englishTokens(v.translation ?? "", { keepStopwords: true }));
    this.translationIndex ??= new ShingleIndex(this.translationTokens, 3);
    const qShingles = shingles(q, 3);
    const candidates = this.translationIndex.candidates(qShingles, 10);
    if (!candidates.length) return null;
    const best = this.bestSpan(qShingles, candidates, this.translationTokens, this.translationIndex, 3);
    // Most of the dataset translation must appear in the text (extra caption text is fine).
    if (!best || best.coverage < 0.6) return null;
    return this.spanResult(best.start, best.end, "possible", Math.round(best.coverage * 100) / 100);
  }
}
