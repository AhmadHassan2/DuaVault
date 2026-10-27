import type { ContentType } from "../types";
import { CONTENT_TYPES, coerceSubcategory } from "../taxonomy";
import { countArabicLetters, countLatinLetters, normalizeArabic } from "../text/arabic";
import type { ClaimedReference } from "../verify/reference-parser";
import type { QuranMatch } from "../verify/quran-matcher";
import type { ReferenceMatch } from "../verify/reference-matcher";
import { TOPIC_BY_SLUG } from "./topics";
import { detectTopics, hasArabic, hasEnglish, textFeatures, type TextFeatures, type TopicHit } from "./tagger";

export interface ClassificationInput {
  arabic: string;
  english: string;
  sourceText: string;
  claimed: ClaimedReference[];
  quranMatch: QuranMatch | null;
  referenceMatch: ReferenceMatch | null;
  /** Hashtags found on the screenshot (without #). */
  hashtags?: string[];
}

export interface ClassificationResult {
  contentType: ContentType;
  subcategory: string;
  tags: string[];
  /** 0..1 — how sure the rules are about the content TYPE. Not about authenticity. */
  confidence: number;
  reasons: string[];
  scores: Record<ContentType, number>;
  strategy: string;
}

/**
 * Strategy interface so a small local model (or an opt-in cloud adapter) can
 * be dropped in later without touching the pipeline or UI.
 */
export interface ClassifierStrategy {
  readonly id: string;
  classify(input: ClassificationInput): ClassificationResult | Promise<ClassificationResult>;
}

interface Signal {
  type: ContentType;
  weight: number;
  reason: string;
  test: (f: TextFeatures, input: ClassificationInput) => boolean;
}

const en = (...words: string[]) => (f: TextFeatures) => words.some((w) => hasEnglish(f, w));
const ar = (...words: string[]) => (f: TextFeatures) => words.some((w) => hasArabic(f, w));
const arStarts = (...words: string[]) => (f: TextFeatures) =>
  words.some((w) => f.arPadded.trimStart().startsWith(normalizeArabic(w)));
const re = (pattern: RegExp) => (_f: TextFeatures, i: ClassificationInput) =>
  pattern.test(`${i.arabic}\n${i.english}\n${i.sourceText}`);

const SIGNALS: Signal[] = [
  // Quran
  { type: "quran", weight: 5, reason: "Text matches the Quran dataset", test: (_f, i) => !!i.quranMatch && i.quranMatch.kind !== "possible" },
  { type: "quran", weight: 2, reason: "Text resembles a Quran verse", test: (_f, i) => !!i.quranMatch && i.quranMatch.kind === "possible" },
  { type: "quran", weight: 3, reason: "Cites a surah/ayah reference", test: (_f, i) => i.claimed.some((c) => c.kind === "quran") },
  { type: "quran", weight: 2, reason: "Uses Quranic brackets ﴿ ﴾", test: re(/[﴾﴿]/) },
  { type: "quran", weight: 1.5, reason: "Mentions the Quran or a verse", test: en("quran", "qur'an", "surah", "ayah", "verse", "allah says", "allah said", "allah tells us") },
  { type: "quran", weight: 1.5, reason: "Introduces Allah's words", test: ar("قال الله تعالى", "قال تعالى") },

  // Hadith
  { type: "hadith", weight: 3, reason: "Cites a hadith collection", test: (_f, i) => i.claimed.some((c) => c.kind === "hadith" && c.collection !== "Hisn al-Muslim") },
  { type: "hadith", weight: 2.5, reason: "Narration phrasing", test: en("narrated", "reported that", "it was narrated", "the prophet said", "prophet muhammad said", "messenger of allah said", "the messenger of allah", "the prophet ﷺ said") },
  { type: "hadith", weight: 2.5, reason: "Arabic narration phrasing", test: ar("قال رسول الله", "عن النبي", "قال النبي", "سمعت رسول الله") },
  { type: "hadith", weight: 1, reason: "Mentions the Prophet ﷺ", test: (f, i) => /ﷺ|\(saw\)|\bpbuh\b|\bsaw\b/i.test(i.english) || hasArabic(f, "صلى الله عليه وسلم") },
  { type: "hadith", weight: 1.5, reason: "Companion honorific", test: ar("رضي الله عنه", "رضي الله عنها", "رضي الله عنهما") },
  { type: "hadith", weight: 0.8, reason: "Mentions a companion", test: en("abu hurairah", "abu hurayrah", "aishah", "aisha", "ibn abbas", "anas ibn malik", "umar") },

  // Dua
  { type: "dua", weight: 3, reason: "Begins like a supplication (اللهم / ربنا / رب)", test: arStarts("اللهم", "ربنا", "رب ", "يا رب", "يا حي يا قيوم") },
  { type: "dua", weight: 1.5, reason: "Contains a supplication phrase", test: ar("اللهم", "ربنا", "رب", "اسالك", "اغفر لي", "ارزقني", "اعوذ بك") },
  { type: "dua", weight: 2.5, reason: "Translation addresses Allah directly", test: en("o allah", "our lord", "my lord", "ya allah", "ya rabb", "i ask you", "i seek refuge") },
  { type: "dua", weight: 2, reason: "Mentions dua or supplication", test: en("dua", "duaa", "du'a", "supplication", "supplicate", "make this dua", "recite this dua") },

  // Adhkar
  { type: "adhkar", weight: 3, reason: "Morning/evening adhkar phrasing", test: ar("اصبحنا", "امسينا", "اصبحت", "امسيت") },
  { type: "adhkar", weight: 2.5, reason: "Mentions adhkar or dhikr", test: en("adhkar", "azkar", "dhikr", "zikr", "remembrance", "morning adhkar", "evening adhkar", "tasbih", "tasbeeh") },
  { type: "adhkar", weight: 2, reason: "Repetition count", test: re(/(\b\d{1,3}\s*(x|times)\b|\(\s*\d{1,3}\s*x?\s*\)|×\s*\d{1,3}|مرات|مره)/i) },
  { type: "adhkar", weight: 1.5, reason: "Classic dhikr phrase", test: ar("سبحان الله", "الحمد لله", "لا اله الا الله", "الله اكبر", "استغفر الله", "لا حول ولا قوه الا بالله", "سبحان الله وبحمده") },
  { type: "adhkar", weight: 1.5, reason: "Tied to a time of day or prayer", test: en("in the morning", "in the evening", "before sleeping", "before sleep", "after every prayer", "after salah", "when waking up") },

  // Reminder
  { type: "reminder", weight: 1.5, reason: "Advice/reminder phrasing", test: en("reminder", "remember", "never forget", "don't forget", "dont forget", "always remember", "advice", "note to self") },
  { type: "reminder", weight: 1.2, reason: "Speaks to the reader", test: (f) => /\b(you|your|yourself)\b/.test(f.enNormalized) },
  { type: "reminder", weight: 1, reason: "Mentions trusting Allah or patience", test: en("trust allah", "tawakkul", "sabr", "have patience", "allah's plan", "allah knows best", "everything happens", "allah is with") },

  // Knowledge
  { type: "knowledge", weight: 2, reason: "Lesson or learning language", test: en("lesson", "lessons", "did you know", "benefit", "learn", "fiqh", "ruling", "pillars", "conditions of", "types of", "aqeedah", "tafsir", "explanation") },
  { type: "knowledge", weight: 2, reason: "Islamic history", test: en("history", "battle", "companion", "companions", "sahabah", "seerah", "caliph", "khalifa", "century", "ottoman", "abbasid", "umayyad", "conquest", "era") },
  { type: "knowledge", weight: 2, reason: "Lecture or scholar reference", test: en("lecture", "sheikh", "shaykh", "imam", "scholar", "scholars", "ustadh", "class", "course", "episode") },
];

function softmaxConfidence(scores: Record<ContentType, number>): { top: ContentType; confidence: number } {
  const entries = (Object.entries(scores) as Array<[ContentType, number]>).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = entries[0];
  const second = entries[1]?.[1] ?? 0;
  if (topScore <= 0) return { top, confidence: 0 };
  // Margin-based confidence: strong absolute evidence and a clear lead both matter.
  const strength = 1 - Math.exp(-topScore / 3);
  const lead = (topScore - second) / topScore;
  return { top, confidence: Math.round(strength * (0.4 + 0.6 * lead) * 100) / 100 };
}

const DUA_SUBCATEGORY_FROM_TOPIC: Record<string, string> = {
  forgiveness: "forgiveness",
  repentance: "forgiveness",
  guidance: "guidance",
  protection: "protection",
  knowledge: "knowledge",
  success: "success",
  family: "family",
  health: "health",
  hardship: "hardship",
  patience: "hardship",
  gratitude: "gratitude",
  travel: "travel",
};

const REMINDER_SUBCATEGORY_FROM_TOPIC: Record<string, string> = {
  tawakkul: "tawakkul",
  patience: "sabr",
  hardship: "sabr",
  gratitude: "gratitude",
  salah: "salah",
  character: "character",
  repentance: "repentance",
  forgiveness: "repentance",
};

export function pickSubcategory(
  type: ContentType,
  topics: TopicHit[],
  f: TextFeatures,
  input: Pick<ClassificationInput, "quranMatch" | "referenceMatch">,
  hadithVerified = false,
): string {
  const slugs = topics.map((t) => t.slug);
  switch (type) {
    case "dua":
      return coerceSubcategory(type, slugs.map((s) => DUA_SUBCATEGORY_FROM_TOPIC[s]).find(Boolean));
    case "adhkar":
      if (slugs.includes("morning") && !slugs.includes("evening")) return "morning";
      if (slugs.includes("evening") && !slugs.includes("morning")) return "evening";
      if (slugs.includes("sleep")) return "sleep";
      if (slugs.includes("after-salah")) return "after-salah";
      return "daily";
    case "quran":
      if (hasEnglish(f, "tafsir") || hasEnglish(f, "commentary") || hasEnglish(f, "explanation")) return "tafsir";
      if (f.enNormalized.split(" ").length > 60 && !input.quranMatch) return "reflections";
      return "verses";
    case "hadith":
      return hadithVerified ? "verified" : "unverified";
    case "reminder":
      return coerceSubcategory(type, slugs.map((s) => REMINDER_SUBCATEGORY_FROM_TOPIC[s]).find(Boolean));
    case "knowledge":
      if (hasEnglish(f, "history") || hasEnglish(f, "battle") || hasEnglish(f, "seerah") || hasEnglish(f, "century")) return "history";
      if (hasEnglish(f, "lecture") || hasEnglish(f, "episode") || hasEnglish(f, "course")) return "lectures";
      if (hasEnglish(f, "lesson") || hasEnglish(f, "benefit")) return "lessons";
      return "general";
  }
}

export class RuleBasedClassifier implements ClassifierStrategy {
  readonly id = "rules-v1";

  classify(input: ClassificationInput): ClassificationResult {
    const f = textFeatures(input.arabic, input.english);
    const scores = Object.fromEntries(CONTENT_TYPES.map((t) => [t, 0])) as Record<ContentType, number>;
    const reasonsByType = new Map<ContentType, string[]>();

    for (const s of SIGNALS) {
      if (!s.test(f, input)) continue;
      scores[s.type] += s.weight;
      reasonsByType.set(s.type, [...(reasonsByType.get(s.type) ?? []), s.reason]);
    }

    // A Quranic verse that is itself a supplication (e.g. starts with ربنا) is filed as a dua,
    // keeping its Quran verification.
    const quranStrong = !!input.quranMatch && input.quranMatch.kind !== "possible";
    if (quranStrong && scores.dua >= 3) {
      scores.dua += scores.quran;
      reasonsByType.set("dua", [...(reasonsByType.get("dua") ?? []), "Quranic supplication"]);
    }

    // Imported dua/dhikr reference matches steer the type.
    const ref = input.referenceMatch;
    if (ref && ref.kind !== "possible") {
      const t: ContentType = ref.entry.kind === "dhikr" ? "adhkar" : ref.entry.kind === "quran" ? "quran" : ref.entry.kind;
      scores[t] += 4;
      reasonsByType.set(t, [...(reasonsByType.get(t) ?? []), `Matches ${ref.entry.sourceName}`]);
    }

    // English-only text without other signals reads most like a reminder.
    const arCount = countArabicLetters(input.arabic);
    const laCount = countLatinLetters(input.english);
    if (arCount === 0 && laCount > 40 && Math.max(...Object.values(scores)) < 1.5) {
      scores.reminder += 1;
      reasonsByType.set("reminder", [...(reasonsByType.get("reminder") ?? []), "English-only advice"]);
    }

    const { top, confidence } = softmaxConfidence(scores);
    const contentType: ContentType = scores[top] > 0 ? top : laCount > 0 && arCount === 0 ? "reminder" : "dua";

    const topics = detectTopics(input.arabic, input.english, f);
    const hadithVerified =
      contentType === "hadith" && !!ref && ref.kind !== "possible" && ref.entry.kind === "hadith";
    const subcategory = pickSubcategory(contentType, topics, f, input, hadithVerified);

    const tags = new Set(topics.slice(0, 5).map((t) => t.slug));
    // Hashtags that name a known topic (#morning, #sabr…) are explicit tags from the poster.
    for (const h of input.hashtags ?? []) {
      if (TOPIC_BY_SLUG.has(h)) tags.add(h);
    }

    return {
      contentType,
      subcategory,
      tags: [...tags],
      confidence: scores[top] > 0 ? confidence : 0.1,
      reasons: reasonsByType.get(contentType) ?? ["No strong signals — please choose a category"],
      scores,
      strategy: this.id,
    };
  }
}

/**
 * Runs several strategies and combines their per-type scores with weights.
 * Today only the rule-based strategy ships; a local model can be added here.
 */
export class CompositeClassifier implements ClassifierStrategy {
  readonly id: string;

  constructor(private readonly strategies: Array<{ strategy: ClassifierStrategy; weight: number }>) {
    if (!strategies.length) throw new Error("CompositeClassifier needs at least one strategy");
    this.id = `composite(${strategies.map((s) => s.strategy.id).join("+")})`;
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const results = await Promise.all(this.strategies.map(async (s) => ({ r: await s.strategy.classify(input), w: s.weight })));
    if (results.length === 1) return results[0].r;
    const scores = Object.fromEntries(CONTENT_TYPES.map((t) => [t, 0])) as Record<ContentType, number>;
    for (const { r, w } of results) for (const t of CONTENT_TYPES) scores[t] += r.scores[t] * w;
    const { top, confidence } = softmaxConfidence(scores);
    const lead = results.find(({ r }) => r.contentType === top)?.r ?? results[0].r;
    return {
      ...lead,
      contentType: top,
      subcategory: lead.contentType === top ? lead.subcategory : coerceSubcategory(top, undefined),
      confidence,
      scores,
      tags: [...new Set(results.flatMap(({ r }) => r.tags))],
      strategy: this.id,
    };
  }
}
