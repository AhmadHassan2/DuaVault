import type { ContentType, SavedItem, VerificationInfo } from "../types";
import { cleanOcrText, type CleanResult } from "../text/clean";
import { segmentLines, type Segment } from "../text/segment";
import type { ClassifierStrategy } from "../classify/classifier";
import { verifyContent, type ReferenceProvider, type VerificationOutcome } from "../verify/verify";
import { findDuplicates, type DuplicateCandidate } from "../dedupe/dedupe";
import { suggestTitle } from "../content/title";
import { suggestedReminderTime } from "../schedule/reminders";

export interface OcrLine {
  text: string;
  /** 0..100 */
  confidence: number;
}

export interface OcrResult {
  text: string;
  /** Mean confidence 0..100 as reported by the engine. */
  confidence: number;
  lines: OcrLine[];
  engine: string;
}

export interface OcrEngine {
  readonly id: string;
  recognize(image: unknown, onProgress?: (fraction: number) => void): Promise<OcrResult>;
}

export type PipelineStep = "uploading" | "reading" | "identifying" | "organizing" | "ready";

export interface DraftItem {
  draftId: string;
  title: string;
  contentType: ContentType;
  subcategory: string;
  tags: string[];
  arabicText: string;
  englishText: string;
  transliteration: string | null;
  sourceText: string;
  verification: VerificationInfo;
  suggestion: VerificationOutcome["suggestion"];
  classification: { confidence: number; reasons: string[]; strategy: string };
  /** Suggested daily reminder for time-bound content (morning/evening/sleep). */
  reminderTime: string | null;
  duplicates: DuplicateCandidate[];
  /** Average OCR confidence of the lines used (0..100), null for typed text. */
  ocrConfidence: number | null;
  lowConfidenceLines: string[];
}

export interface ExtractionResult {
  ocr: OcrResult | null;
  cleaned: CleanResult;
  drafts: DraftItem[];
  warnings: string[];
}

export interface PipelineDeps {
  classifier: ClassifierStrategy;
  references: ReferenceProvider;
  existingItems: () => Promise<SavedItem[]>;
  onStep?: (step: PipelineStep, detail?: string) => void;
  now?: () => Date;
  newId?: () => string;
}

export const LOW_CONFIDENCE_LINE = 60;
export const LOW_CONFIDENCE_PAGE = 70;

let draftCounter = 0;
const defaultId = () => `draft-${Date.now().toString(36)}-${(draftCounter++).toString(36)}`;

async function buildDraft(
  segment: Segment,
  hashtags: string[],
  deps: PipelineDeps,
  existing: SavedItem[],
): Promise<DraftItem> {
  const [quran, refs] = await Promise.all([
    deps.references.getQuranMatcher(),
    deps.references.getReferenceMatcher(),
  ]);
  const outcome = verifyContent(
    { arabic: segment.arabic, english: segment.english, sourceText: segment.source },
    quran,
    refs,
    deps.now?.() ?? new Date(),
  );

  const classification = await deps.classifier.classify({
    arabic: segment.arabic,
    english: segment.english,
    sourceText: segment.source,
    claimed: outcome.claimed,
    quranMatch: outcome.quranMatch,
    referenceMatch: outcome.referenceMatch,
    hashtags,
  });

  // Transliteration is only taken from a verified dataset match.
  const transliteration =
    outcome.verification.status === "verified_match" && outcome.suggestion?.transliteration
      ? outcome.suggestion.transliteration
      : null;

  const lowConfidenceLines = segment.lines
    .filter((l) => l.confidence !== null && l.confidence < LOW_CONFIDENCE_LINE && l.text)
    .map((l) => l.text);

  return {
    draftId: (deps.newId ?? defaultId)(),
    title: suggestTitle({
      contentType: classification.contentType,
      subcategory: classification.subcategory,
      english: segment.english,
      arabic: segment.arabic,
      referenceLabel: outcome.verification.status === "verified_match" ? outcome.verification.referenceLabel : undefined,
    }),
    contentType: classification.contentType,
    subcategory: classification.subcategory,
    tags: classification.tags,
    arabicText: segment.arabic,
    englishText: segment.english,
    transliteration,
    sourceText: segment.source,
    verification: outcome.verification,
    suggestion: outcome.suggestion,
    classification: {
      confidence: classification.confidence,
      reasons: classification.reasons,
      strategy: classification.strategy,
    },
    reminderTime: suggestedReminderTime(classification),
    duplicates: findDuplicates({ arabicText: segment.arabic, englishText: segment.english }, existing),
    ocrConfidence: segment.confidence,
    lowConfidenceLines,
  };
}

async function draftsFromClean(
  cleaned: CleanResult,
  deps: PipelineDeps,
  warnings: string[],
): Promise<DraftItem[]> {
  deps.onStep?.("identifying");
  const segments = segmentLines(cleaned.lines);
  if (!segments.length) {
    warnings.push("No readable text was found. Try a sharper screenshot, crop closer to the text, or type it in.");
    return [];
  }
  if (segments.length > 1) {
    warnings.push(`This screenshot looks like it contains ${segments.length} separate items. Review each one.`);
  }
  const existing = await deps.existingItems();
  deps.onStep?.("organizing");
  const drafts: DraftItem[] = [];
  for (const s of segments) drafts.push(await buildDraft(s, cleaned.hashtags, deps, existing));
  return drafts;
}

/** Full screenshot pipeline: OCR → clean → segment → verify → classify → dedupe. */
export async function processScreenshot(image: unknown, ocr: OcrEngine, deps: PipelineDeps): Promise<ExtractionResult> {
  const warnings: string[] = [];
  deps.onStep?.("reading");
  const result = await ocr.recognize(image, (f) => deps.onStep?.("reading", `${Math.round(f * 100)}%`));
  const cleaned = cleanOcrText(result.text, result.lines);
  if (result.text.trim() && result.confidence < LOW_CONFIDENCE_PAGE) {
    warnings.push(
      `Text recognition confidence is low (${Math.round(result.confidence)}%). The image may be blurry or stylised — please check the text carefully.`,
    );
  }
  const drafts = await draftsFromClean(cleaned, deps, warnings);
  deps.onStep?.("ready");
  return { ocr: result, cleaned, drafts, warnings };
}

/** Same pipeline for text the user typed or pasted (no OCR). */
export async function processText(text: string, deps: PipelineDeps): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const cleaned = cleanOcrText(text);
  const drafts = await draftsFromClean(cleaned, deps, warnings);
  deps.onStep?.("ready");
  return { ocr: null, cleaned, drafts, warnings };
}

/** Re-runs verification + classification after the user edits a draft's text. */
export async function reanalyzeDraft(draft: DraftItem, deps: PipelineDeps): Promise<DraftItem> {
  const existing = await deps.existingItems();
  const lines = [
    ...draft.arabicText.split("\n"),
    ...draft.englishText.split("\n"),
    ...draft.sourceText.split("\n"),
  ];
  const segment: Segment = {
    arabic: draft.arabicText,
    english: draft.englishText,
    source: draft.sourceText,
    lines: lines.map((text) => ({ text, script: "none", confidence: null })),
    confidence: draft.ocrConfidence,
  };
  const fresh = await buildDraft(segment, [], deps, existing);
  return { ...fresh, draftId: draft.draftId, lowConfidenceLines: draft.lowConfidenceLines };
}
