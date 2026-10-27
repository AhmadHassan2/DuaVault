import type { ContentType, SavedItem } from "../types";
import { TAXONOMY, subcategoryLabel } from "../taxonomy";
import { arabicTokens, hasArabic } from "../text/arabic";
import { englishTokens, normalizeEnglish, stem } from "../text/english";
import { TOPICS, topicLabel } from "../classify/topics";

export interface ParsedQuery {
  raw: string;
  terms: string[];
  arabicTerms: string[];
  /** Topics inferred from the situation described. */
  topics: Array<{ slug: string; because: string }>;
  /** Content type explicitly asked for ("duas for…", "reminders about…"). */
  contentType: ContentType | null;
}

const TYPE_WORDS: Array<[ContentType, string[]]> = [
  ["dua", ["dua", "duas", "duaa", "supplication", "supplications"]],
  ["adhkar", ["adhkar", "azkar", "dhikr", "zikr", "remembrance"]],
  ["quran", ["quran", "verse", "verses", "ayah", "ayat", "surah"]],
  ["hadith", ["hadith", "hadiths", "ahadith", "narration", "narrations"]],
  ["reminder", ["reminder", "reminders", "advice"]],
  ["knowledge", ["lesson", "lessons", "knowledge", "history", "lecture", "lectures"]],
];

export function parseQuery(raw: string): ParsedQuery {
  const norm = ` ${normalizeEnglish(raw)} `;
  const stems = new Set(englishTokens(raw, { keepStopwords: true }));

  let contentType: ContentType | null = null;
  for (const [type, words] of TYPE_WORDS) {
    if (words.some((w) => norm.includes(` ${w} `))) {
      contentType = type;
      break;
    }
  }

  const topics: ParsedQuery["topics"] = [];
  for (const t of TOPICS) {
    const phrase = [...t.situations, ...t.en].find((p) => {
      const n = normalizeEnglish(p);
      return n.includes(" ") ? norm.includes(` ${n} `) : stems.has(stem(n));
    });
    if (phrase) topics.push({ slug: t.slug, because: phrase });
  }

  const typeWords = new Set(TYPE_WORDS.flatMap(([, w]) => w).map(stem));
  const terms = englishTokens(raw).filter((t) => !typeWords.has(t));
  const arabicTerms = hasArabic(raw) ? arabicTokens(raw) : [];
  return { raw, terms, arabicTerms, topics, contentType };
}

export interface SearchHit<T> {
  item: T;
  score: number;
  matchedTopics: string[];
}

export interface SearchableDoc {
  id: string;
  title: string;
  english: string;
  arabic: string;
  tags: string[];
  contentType: ContentType;
  subcategory: string;
}

export function itemToDoc(item: SavedItem): SearchableDoc {
  return {
    id: item.id,
    title: item.title,
    english: `${item.englishText} ${item.notes} ${item.sourceText ?? ""}`,
    arabic: item.arabicText,
    tags: item.tags,
    contentType: item.contentType,
    subcategory: item.subcategory,
  };
}

interface Prepared {
  titleTokens: Set<string>;
  bodyTokens: string[];
  arTokens: Set<string>;
  tagSet: Set<string>;
  subLabelTokens: Set<string>;
}

function prepare(doc: SearchableDoc): Prepared {
  return {
    titleTokens: new Set(englishTokens(doc.title)),
    bodyTokens: englishTokens(doc.english),
    arTokens: new Set(arabicTokens(doc.arabic)),
    tagSet: new Set(doc.tags),
    subLabelTokens: new Set(englishTokens(subcategoryLabel(doc.contentType, doc.subcategory))),
  };
}

/**
 * Scores documents for a free-text / situational query. Keyword matches
 * (BM25-lite on the body) plus boosts for topic tags inferred from the query.
 */
export function searchDocs<T>(docs: Array<{ doc: SearchableDoc; item: T }>, query: string | ParsedQuery): Array<SearchHit<T>> {
  const q = typeof query === "string" ? parseQuery(query) : query;
  if (!q.terms.length && !q.arabicTerms.length && !q.topics.length && !q.contentType) return [];

  const prepared = docs.map((d) => ({ ...d, p: prepare(d.doc) }));
  const N = prepared.length || 1;
  const avgLen = prepared.reduce((s, d) => s + d.p.bodyTokens.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const term of q.terms) df.set(term, prepared.filter((d) => d.p.bodyTokens.includes(term)).length);

  const k1 = 1.2;
  const b = 0.75;
  const hits: Array<SearchHit<T>> = [];
  for (const { doc, item, p } of prepared) {
    let score = 0;
    const matchedTopics: string[] = [];

    for (const term of q.terms) {
      const tf = p.bodyTokens.filter((t) => t === term).length;
      if (tf) {
        const idf = Math.log(1 + (N - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
        score += (idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * p.bodyTokens.length) / avgLen));
      }
      if (p.titleTokens.has(term)) score += 2;
      if (p.subLabelTokens.has(term)) score += 1.5;
      if (p.tagSet.has(term)) score += 2;
    }
    for (const term of q.arabicTerms) if (p.arTokens.has(term)) score += 2.5;
    for (const t of q.topics) {
      if (p.tagSet.has(t.slug) || p.subLabelTokens.has(stem(t.slug))) {
        score += 3;
        matchedTopics.push(t.slug);
      }
    }
    if (q.contentType) {
      if (doc.contentType === q.contentType) score = score > 0 ? score + 1.5 : (q.terms.length || q.topics.length ? 0 : 1);
      else score *= 0.4;
    }
    if (score > 0) hits.push({ item, score: Math.round(score * 100) / 100, matchedTopics });
  }
  return hits.sort((a, b) => b.score - a.score);
}

export function searchItems(items: SavedItem[], query: string): Array<SearchHit<SavedItem>> {
  return searchDocs(items.map((item) => ({ doc: itemToDoc(item), item })), query);
}

/** Human-readable explanation of how a query was interpreted. */
export function explainQuery(q: ParsedQuery): string | null {
  const parts: string[] = [];
  if (q.contentType) parts.push(TAXONOMY.find((t) => t.type === q.contentType)!.label.toLowerCase());
  if (q.topics.length) parts.push(`about ${q.topics.map((t) => topicLabel(t.slug)).join(", ")}`);
  if (!parts.length) return null;
  return q.contentType ? `Looking for ${parts.join(" ")}` : `Looking for things ${parts.join(" ")}`;
}
