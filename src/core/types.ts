/**
 * Shared domain types. This module (and everything under src/core) must stay
 * free of React, Next.js and DOM dependencies so it can be reused by a future
 * React Native / Expo client.
 */

export type ContentType =
  | "dua"
  | "adhkar"
  | "quran"
  | "hadith"
  | "reminder"
  | "knowledge";

export type VerificationStatus =
  /** Text matched a record in a trusted, imported dataset. */
  | "verified_match"
  /** Text resembles a trusted record but differs — user should compare. */
  | "possible_match"
  /** A source was written on the screenshot/by the user but not confirmed. */
  | "user_provided_unverified"
  /** No source and no dataset match. */
  | "unverified"
  /** Something conflicts (e.g. claimed reference does not match the text). */
  | "review_required";

export type MemorizationState = "not_started" | "learning" | "familiar" | "memorized";

export interface VerificationInfo {
  status: VerificationStatus;
  /** Id of the matched reference record (dataset-specific, e.g. "quran:2:286"). */
  referenceId?: string;
  /** Human readable reference, taken from the dataset — never generated. */
  referenceLabel?: string;
  /** Name of the dataset the match came from. */
  sourceName?: string;
  /** 0..1 textual similarity score. This is NOT an authenticity score. */
  matchScore?: number;
  matchKind?: "exact" | "partial" | "possible";
  /** Grade and the dataset that supplied it, only when the dataset provides one. */
  grade?: string;
  gradeSource?: string;
  /** Explanations shown to the user. */
  notes: string[];
  checkedAt: string;
}

export interface SavedItem {
  id: string;
  title: string;
  contentType: ContentType;
  /** Subcategory slug within the content type (see taxonomy.ts). */
  subcategory: string;
  arabicText: string;
  englishText: string;
  /** Only ever populated from a trusted dataset or typed by the user. */
  transliteration: string | null;
  /** Untouched OCR output, kept for provenance. */
  ocrRawText: string | null;
  ocrConfidence: number | null;
  /** Source/reference text as claimed on the screenshot or by the user. */
  sourceText: string | null;
  verification: VerificationInfo;
  /** Storage key of the original screenshot, if any. */
  screenshotKey: string | null;
  tags: string[];
  notes: string;
  isFavorite: boolean;
  /** Daily reminder time "HH:MM" (local), e.g. morning adhkar at 07:00. */
  reminderTime: string | null;
  practiceCount: number;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
}

export type NewSavedItem = Omit<
  SavedItem,
  "id" | "createdAt" | "updatedAt" | "lastReviewedAt" | "practiceCount"
>;

export interface MemorizationProgress {
  itemId: string;
  state: MemorizationState;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type PracticeKind = "viewed" | "practiced" | "memorization_review";

export interface PracticeEvent {
  id: string;
  itemId: string;
  kind: PracticeKind;
  at: string;
  rating?: MemorizationState;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  /** Optional Arabic the user wrote themselves. Never treated as Quran/hadith. */
  arabicText: string;
  topic: string;
  reminderEnabled: boolean;
  /** "HH:MM" local time. */
  reminderTime: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A record from a trusted, imported reference dataset (Quran, hadith, dua books). */
export interface ReferenceEntry {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: "quran" | "hadith" | "dua" | "dhikr";
  arabic: string;
  translation?: string;
  transliteration?: string;
  referenceLabel: string;
  grade?: string;
  gradeSource?: string;
  topics?: string[];
  /** For Quran entries. */
  surah?: number;
  ayah?: number;
}

export interface ReferenceSourceInfo {
  id: string;
  name: string;
  kind: ReferenceEntry["kind"];
  licence: string;
  url: string;
  entryCount: number;
  importedAt: string;
}
