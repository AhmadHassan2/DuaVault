/**
 * Word n-gram ("shingle") index for fuzzy matching of normalized text against
 * a reference corpus. Deterministic and dependency-free.
 */

export function shingles(tokens: string[], n: number): string[] {
  if (tokens.length === 0) return [];
  if (tokens.length < n) return [tokens.join(" ")];
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

export function shingleSize(tokenCount: number): number {
  if (tokenCount >= 6) return 3;
  if (tokenCount >= 3) return 2;
  return 1;
}

export class ShingleIndex {
  private readonly postings = new Map<string, number[]>();
  readonly entryShingles: string[][];

  constructor(
    entryTokens: string[][],
    readonly n: number,
  ) {
    this.entryShingles = entryTokens.map((tokens) => shingles(tokens, n));
    this.entryShingles.forEach((list, idx) => {
      for (const s of new Set(list)) {
        const p = this.postings.get(s);
        if (p) p.push(idx);
        else this.postings.set(s, [idx]);
      }
    });
  }

  /** Entry indices ranked by how many distinct query shingles they contain. */
  candidates(queryShingles: string[], limit = 20): Array<{ index: number; hits: number }> {
    const counts = new Map<number, number>();
    for (const s of new Set(queryShingles)) {
      const p = this.postings.get(s);
      if (!p) continue;
      // Extremely common shingles carry little signal; cap their fan-out.
      if (p.length > 400) continue;
      for (const idx of p) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([index, hits]) => ({ index, hits }))
      .sort((a, b) => b.hits - a.hits || a.index - b.index)
      .slice(0, limit);
  }
}

export interface OverlapScore {
  /** Share of the query's shingles found in the candidate (0..1). */
  containment: number;
  /** Share of the candidate's shingles found in the query (0..1). */
  coverage: number;
  /** Dice coefficient (0..1). */
  dice: number;
}

export function overlap(query: string[], candidate: string[]): OverlapScore {
  const q = new Set(query);
  const c = new Set(candidate);
  if (!q.size || !c.size) return { containment: 0, coverage: 0, dice: 0 };
  let common = 0;
  for (const s of q) if (c.has(s)) common++;
  return {
    containment: common / q.size,
    coverage: common / c.size,
    dice: (2 * common) / (q.size + c.size),
  };
}
