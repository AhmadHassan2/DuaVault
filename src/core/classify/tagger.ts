import { normalizeArabic } from "../text/arabic";
import { englishTokens, normalizeEnglish, stem } from "../text/english";
import { TOPICS } from "./topics";

export interface TopicHit {
  slug: string;
  score: number;
  matched: string[];
}

export interface TextFeatures {
  enNormalized: string;
  enPadded: string;
  enStems: Set<string>;
  arPadded: string;
}

export function textFeatures(arabic: string, english: string): TextFeatures {
  const enNormalized = normalizeEnglish(english);
  return {
    enNormalized,
    enPadded: ` ${enNormalized} `,
    enStems: new Set(englishTokens(english, { keepStopwords: true })),
    arPadded: ` ${normalizeArabic(arabic)} `,
  };
}

export function hasEnglish(f: TextFeatures, keyword: string): boolean {
  const k = normalizeEnglish(keyword);
  if (!k) return false;
  if (k.includes(" ")) return f.enPadded.includes(` ${k} `);
  return f.enStems.has(stem(k));
}

export function hasArabic(f: TextFeatures, keyword: string): boolean {
  const k = normalizeArabic(keyword);
  if (!k) return false;
  // Arabic attaches prefixes (و، ف، ب، ل، ال) so match on word starts rather than whole words.
  return f.arPadded.includes(` ${k}`) || f.arPadded.includes(` و${k}`) || f.arPadded.includes(` ف${k}`);
}

/** Detects topic tags from text using the topic lexicon. */
export function detectTopics(arabic: string, english: string, features = textFeatures(arabic, english)): TopicHit[] {
  const hits: TopicHit[] = [];
  for (const topic of TOPICS) {
    const matched: string[] = [];
    let score = 0;
    for (const k of topic.en) {
      if (hasEnglish(features, k)) {
        matched.push(k);
        score += k.includes(" ") ? 1.5 : 1;
      }
    }
    for (const k of topic.ar) {
      if (hasArabic(features, k)) {
        matched.push(k);
        score += 1.5;
      }
    }
    if (score > 0) hits.push({ slug: topic.slug, score, matched });
  }
  return hits.sort((a, b) => b.score - a.score);
}
