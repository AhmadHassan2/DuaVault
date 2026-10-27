import type { VerificationInfo } from "../types";
import { formatClaimedReference, parseClaimedReferences, type ClaimedReference } from "./reference-parser";
import type { QuranMatch, QuranMatcher } from "./quran-matcher";
import type { ReferenceEntryMatcher, ReferenceMatch } from "./reference-matcher";

export interface ReferenceProvider {
  getQuranMatcher(): Promise<QuranMatcher | null>;
  getReferenceMatcher(): Promise<ReferenceEntryMatcher | null>;
}

export interface VerificationInput {
  arabic: string;
  english: string;
  sourceText: string;
}

export interface VerificationOutcome {
  verification: VerificationInfo;
  claimed: ClaimedReference[];
  quranMatch: QuranMatch | null;
  referenceMatch: ReferenceMatch | null;
  /**
   * Dataset wording the user may choose to adopt (e.g. when OCR text is close
   * but not identical). Never applied automatically.
   */
  suggestion: { arabic: string; translation?: string; transliteration?: string; label: string } | null;
}

const POSSIBLE_THRESHOLD = 0.55;

export function verifyContent(
  input: VerificationInput,
  quran: QuranMatcher | null,
  references: ReferenceEntryMatcher | null,
  now: Date = new Date(),
): VerificationOutcome {
  const notes: string[] = [];
  const claimed = parseClaimedReferences([input.sourceText, input.english, input.arabic].join("\n"));
  const claimedQuran = claimed.find((c) => c.kind === "quran");
  const checkedAt = now.toISOString();
  const arabic = input.arabic.trim();

  let quranMatch: QuranMatch | null = null;
  let referenceMatch: ReferenceMatch | null = null;
  let suggestion: VerificationOutcome["suggestion"] = null;

  const base = (status: VerificationInfo["status"]): VerificationInfo => ({ status, notes, checkedAt });

  // Arabic OCR is the weak spot; the English translation often survives intact. A translation
  // match can point the user at the dataset wording but never verifies the Arabic by itself.
  let translationMatch: QuranMatch | null | undefined;
  const byTranslation = () => (translationMatch ??= quran && input.english.trim() ? quran.matchTranslation(input.english) : null);
  const fromTranslation = (m: QuranMatch, note: string): VerificationOutcome => {
    notes.unshift(note);
    return {
      verification: {
        ...base("possible_match"),
        referenceId: `quran:${m.surah}:${m.ayahStart}-${m.ayahEnd}`,
        referenceLabel: m.label,
        sourceName: quran!.dataset.sourceName,
        matchScore: m.score,
        matchKind: "possible",
      },
      claimed,
      quranMatch: m,
      referenceMatch: null,
      suggestion: { arabic: m.text, translation: m.translation, label: m.label },
    };
  };

  if (!quran) notes.push("Quran dataset not loaded on this device, so Quran verification was skipped.");
  if (!references || references.size === 0) {
    notes.push("No hadith or dua reference datasets are imported yet.");
  }

  // 1. A specific Quran reference was claimed — check the text against it.
  if (quran && claimedQuran && claimedQuran.kind === "quran") {
    const label = formatClaimedReference(claimedQuran);
    if (arabic) {
      const cmp = quran.compareWithReference(arabic, claimedQuran.surah, claimedQuran.ayahStart, claimedQuran.ayahEnd);
      if (cmp && (cmp.kind === "exact" || cmp.kind === "partial")) {
        notes.unshift(
          cmp.kind === "exact"
            ? `Arabic text matches ${cmp.label} in ${quran.dataset.sourceName}.`
            : `Arabic text matches part of ${cmp.label} in ${quran.dataset.sourceName}.`,
        );
        return {
          verification: {
            ...base("verified_match"),
            referenceId: `quran:${cmp.surah}:${cmp.ayahStart}-${cmp.ayahEnd}`,
            referenceLabel: cmp.label,
            sourceName: quran.dataset.sourceName,
            matchScore: 1,
            matchKind: cmp.kind,
          },
          claimed,
          quranMatch: cmp,
          referenceMatch: null,
          suggestion: null,
        };
      }
      if (cmp && cmp.score >= POSSIBLE_THRESHOLD) {
        notes.unshift(
          `The screenshot cites ${label}. The text is similar to the dataset wording but not identical — compare before relying on it.`,
        );
        return {
          verification: {
            ...base("possible_match"),
            referenceId: `quran:${cmp.surah}:${cmp.ayahStart}-${cmp.ayahEnd}`,
            referenceLabel: cmp.label,
            sourceName: quran.dataset.sourceName,
            matchScore: round(cmp.score),
            matchKind: "possible",
          },
          claimed,
          quranMatch: cmp,
          referenceMatch: null,
          suggestion: { arabic: cmp.text, translation: cmp.translation, label: cmp.label },
        };
      }
      // The Arabic doesn't match the claim — it may simply have been misread. If the
      // translation matches the cited verses, offer their dataset wording to compare.
      const tm = byTranslation();
      if (tm && tm.surah === claimedQuran.surah && tm.ayahStart <= claimedQuran.ayahEnd && tm.ayahEnd >= claimedQuran.ayahStart) {
        return fromTranslation(
          tm,
          `The screenshot cites ${label} and its translation matches the dataset, but the Arabic was only partly readable. Compare it with the dataset wording below.`,
        );
      }
      // Claimed reference does not match. See if the text is a different verse.
      const actual = quran.match(arabic);
      notes.unshift(
        actual && actual.kind !== "possible"
          ? `The screenshot cites ${label}, but the Arabic matches ${actual.label}. Please review the reference.`
          : `The screenshot cites ${label}, but the Arabic text does not match that reference. Please review.`,
      );
      // Offer the wording to compare against: the verse it actually resembles, else the cited one.
      return {
        verification: { ...base("review_required"), matchScore: cmp ? round(cmp.score) : 0 },
        claimed,
        quranMatch: actual,
        referenceMatch: null,
        suggestion: actual
          ? { arabic: actual.text, translation: actual.translation, label: actual.label }
          : cmp
            ? { arabic: cmp.text, translation: cmp.translation, label: cmp.label }
            : null,
      };
    }
    // No Arabic captured — offer the dataset text for the claimed reference without verifying.
    const span = quran.getSpan(claimedQuran.surah, claimedQuran.ayahStart, claimedQuran.ayahEnd);
    if (span.length) {
      const lbl = quran.label(claimedQuran.surah, claimedQuran.ayahStart, claimedQuran.ayahEnd);
      const translations = span.map((v) => v.translation).filter(Boolean);
      suggestion = {
        arabic: span.map((v) => v.text).join(" "),
        translation: translations.length ? translations.join(" ") : undefined,
        label: lbl,
      };
      notes.unshift(
        `The screenshot cites ${label}, but no Arabic text was captured to compare. You can load the dataset text for ${lbl}.`,
      );
    }
  }

  // 2. No usable claim — search the datasets.
  if (arabic) {
    if (quran) quranMatch = quran.match(arabic);
    if (references && references.size) referenceMatch = references.match(arabic);

    const quranStrong = quranMatch && quranMatch.kind !== "possible";
    const refStrong = referenceMatch && referenceMatch.kind !== "possible";

    if (quranStrong && quran && quranMatch) {
      notes.unshift(
        quranMatch.kind === "exact"
          ? `Arabic text matches ${quranMatch.label} in ${quran.dataset.sourceName}.`
          : `Arabic text matches part of ${quranMatch.label} in ${quran.dataset.sourceName}.`,
      );
      return {
        verification: {
          ...base("verified_match"),
          referenceId: `quran:${quranMatch.surah}:${quranMatch.ayahStart}-${quranMatch.ayahEnd}`,
          referenceLabel: quranMatch.label,
          sourceName: quran.dataset.sourceName,
          matchScore: 1,
          matchKind: quranMatch.kind,
        },
        claimed,
        quranMatch,
        referenceMatch,
        suggestion: null,
      };
    }
    if (refStrong && referenceMatch) {
      const e = referenceMatch.entry;
      notes.unshift(`Arabic text matches “${e.referenceLabel}” in ${e.sourceName}.`);
      if (e.grade && e.gradeSource) notes.push(`Grade “${e.grade}” as recorded by ${e.gradeSource}.`);
      return {
        verification: {
          ...base("verified_match"),
          referenceId: e.id,
          referenceLabel: e.referenceLabel,
          sourceName: e.sourceName,
          matchScore: 1,
          matchKind: referenceMatch.kind,
          grade: e.grade,
          gradeSource: e.gradeSource,
        },
        claimed,
        quranMatch,
        referenceMatch,
        suggestion: e.transliteration
          ? { arabic: e.arabic, translation: e.translation, transliteration: e.transliteration, label: e.referenceLabel }
          : null,
      };
    }

    const possible = pickPossible(quranMatch, referenceMatch);
    if (possible) {
      notes.unshift(
        `Similar to ${possible.label} in ${possible.sourceName}, but not identical. OCR errors or a different wording may explain the difference — compare before relying on it.`,
      );
      return {
        verification: {
          ...base("possible_match"),
          referenceId: possible.id,
          referenceLabel: possible.label,
          sourceName: possible.sourceName,
          matchScore: round(possible.score),
          matchKind: "possible",
        },
        claimed,
        quranMatch,
        referenceMatch,
        suggestion: possible.suggestion,
      };
    }
  }

  const tm = arabic ? byTranslation() : null;
  if (tm) {
    return fromTranslation(
      tm,
      `The Arabic couldn't be matched (it may have been misread), but the translation matches ${tm.label}. Compare it with the dataset wording below.`,
    );
  }

  if (claimed.length) {
    notes.unshift(
      `The screenshot cites ${claimed.map(formatClaimedReference).join(", ")}. DuaVault could not confirm this against a loaded dataset.`,
    );
    return { verification: base("user_provided_unverified"), claimed, quranMatch, referenceMatch, suggestion };
  }

  notes.unshift("No source was found on the screenshot and the text did not match a loaded dataset.");
  return { verification: base("unverified"), claimed, quranMatch, referenceMatch, suggestion };
}

function pickPossible(q: QuranMatch | null, r: ReferenceMatch | null) {
  const options: Array<{
    id: string;
    label: string;
    sourceName: string;
    score: number;
    suggestion: NonNullable<VerificationOutcome["suggestion"]>;
  }> = [];
  if (q && q.score >= POSSIBLE_THRESHOLD) {
    options.push({
      id: `quran:${q.surah}:${q.ayahStart}-${q.ayahEnd}`,
      label: q.label,
      sourceName: "the Quran dataset",
      score: q.score,
      suggestion: { arabic: q.text, translation: q.translation, label: q.label },
    });
  }
  if (r && r.score >= POSSIBLE_THRESHOLD) {
    options.push({
      id: r.entry.id,
      label: `“${r.entry.referenceLabel}”`,
      sourceName: r.entry.sourceName,
      score: r.score,
      suggestion: {
        arabic: r.entry.arabic,
        translation: r.entry.translation,
        transliteration: r.entry.transliteration,
        label: r.entry.referenceLabel,
      },
    });
  }
  return options.sort((a, b) => b.score - a.score)[0] ?? null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
