import { describe, expect, it } from "vitest";
import { verifyContent } from "@/core/verify/verify";
import { ReferenceEntryMatcher } from "@/core/verify/reference-matcher";
import type { ReferenceEntry } from "@/core/types";
import { quranMatcher, verse } from "./helpers";

describe("QuranMatcher", () => {
  it("finds an exact single-verse match", () => {
    const m = quranMatcher.match(verse(2, 286).matchText!);
    expect(m).toMatchObject({ kind: "exact", surah: 2, ayahStart: 286, ayahEnd: 286 });
  });

  it("matches Uthmani-script text exactly", () => {
    const m = quranMatcher.match(verse(20, 114).text);
    expect(m?.kind).toBe("exact");
    expect(m?.ayahStart).toBe(114);
  });

  it("matches a multi-verse span", () => {
    const text = `${verse(94, 5).matchText} ${verse(94, 6).matchText}`;
    expect(quranMatcher.match(text)).toMatchObject({ kind: "exact", surah: 94, ayahStart: 5, ayahEnd: 6 });
  });

  it("reports a partial verse as 'partial', not exact", () => {
    const words = verse(2, 286).matchText!.split(" ");
    const part = words.slice(20, 32).join(" ");
    expect(quranMatcher.match(part)).toMatchObject({ kind: "partial", surah: 2, ayahStart: 286 });
  });

  it("reports OCR-damaged text only as a possible match", () => {
    const words = verse(2, 286).matchText!.split(" ");
    words[3] = "خطا";
    words[10] = "كلمه";
    const m = quranMatcher.match(words.join(" "));
    expect(m?.kind).toBe("possible");
    expect(m?.surah).toBe(2);
  });

  it("returns null for unrelated text", () => {
    expect(quranMatcher.match("هذا نص تجريبي لا علاقه له بشيء")).toBeNull();
  });
});

describe("verifyContent", () => {
  it("marks an exact Quran match as verified, with the dataset label", () => {
    const out = verifyContent({ arabic: verse(20, 25).text, english: "", sourceText: "" }, quranMatcher, null);
    expect(out.verification.status).toBe("verified_match");
    expect(out.verification.referenceLabel).toContain("20:25");
    expect(out.verification.sourceName).toBe("Tanzil Quran Text");
  });

  it("flags a claimed reference that doesn't match the text", () => {
    const out = verifyContent({ arabic: verse(20, 25).text, english: "", sourceText: "Quran 2:255" }, quranMatcher, null);
    expect(out.verification.status).toBe("review_required");
    expect(out.verification.notes[0]).toMatch(/20:25/);
  });

  it("offers the cited verse's wording for comparison when the text matches nothing, without verifying", () => {
    const out = verifyContent({ arabic: "كلمات غير مقروءه تماما هنا", english: "", sourceText: "Quran 94:5" }, quranMatcher, null);
    expect(out.verification.status).toBe("review_required");
    expect(out.suggestion?.label).toContain("94:5");
  });

  it("falls back to the translation when the Arabic is unreadable, without verifying", () => {
    const english = [25, 26, 27, 28].map((a) => verse(20, a).translation).join(" ");
    const out = verifyContent({ arabic: "قال رب سسس لى صدرى ونير", english, sourceText: "Surah Taha 20:25-28" }, quranMatcher, null);
    expect(out.verification.status).toBe("possible_match");
    expect(out.verification.referenceLabel).toContain("20:25-28");
    expect(out.suggestion?.arabic).toContain(verse(20, 25).text);

    const noClaim = verifyContent({ arabic: "كلام غير مقروء هنا", english, sourceText: "" }, quranMatcher, null);
    expect(noClaim.verification.status).toBe("possible_match");
  });

  it("keeps a claimed hadith reference as user-provided and unverified", () => {
    const out = verifyContent({ arabic: "", english: "The Prophet said…", sourceText: "Sahih Muslim 2699" }, quranMatcher, null);
    expect(out.verification.status).toBe("user_provided_unverified");
    expect(out.verification.grade).toBeUndefined();
  });

  it("is unverified when nothing matches and no source is given", () => {
    const out = verifyContent({ arabic: "", english: "Be kind to people", sourceText: "" }, null, null);
    expect(out.verification.status).toBe("unverified");
    expect(out.verification.notes.join(" ")).toMatch(/not loaded/);
  });

  it("offers dataset text for a claimed verse when no Arabic was captured, without verifying", () => {
    const out = verifyContent({ arabic: "", english: "Indeed with hardship comes ease", sourceText: "Quran 94:5" }, quranMatcher, null);
    expect(out.verification.status).toBe("user_provided_unverified");
    expect(out.suggestion?.arabic).toBe(verse(94, 5).text);
  });

  it("uses grades only when the imported dataset provides them", () => {
    const entry: ReferenceEntry = {
      id: "test:1",
      sourceId: "test",
      sourceName: "Test Dataset",
      kind: "dua",
      arabic: verse(20, 25).matchText!,
      referenceLabel: "Test entry 1",
      transliteration: "test transliteration",
    };
    const refs = new ReferenceEntryMatcher([entry]);
    const out = verifyContent({ arabic: verse(20, 25).matchText!, english: "", sourceText: "" }, null, refs);
    expect(out.verification.status).toBe("verified_match");
    expect(out.verification.grade).toBeUndefined();
    expect(out.suggestion?.transliteration).toBe("test transliteration");
  });
});
