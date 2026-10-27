import { describe, expect, it } from "vitest";
import { detectScript, normalizeArabic, stripDiacritics, toWesternDigits } from "@/core/text/arabic";
import { cleanOcrText } from "@/core/text/clean";
import { segmentLines } from "@/core/text/segment";
import { parseClaimedReferences } from "@/core/verify/reference-parser";
import { verse } from "./helpers";

describe("arabic normalization", () => {
  it("folds Uthmani marks (ٱ, harakat) to plain letters", () => {
    const v = verse(1, 1);
    expect(normalizeArabic(v.text)).toBe(normalizeArabic(v.matchText!));
  });

  it("does not mutate the input string", () => {
    const original = verse(2, 286).text;
    const copy = original.slice();
    normalizeArabic(original);
    stripDiacritics(original);
    expect(original).toBe(copy);
  });

  it("detects scripts", () => {
    expect(detectScript(verse(1, 1).text)).toBe("arabic");
    expect(detectScript("O Allah, forgive me")).toBe("latin");
    expect(detectScript("...")).toBe("none");
  });

  it("converts Arabic-Indic digits", () => {
    expect(toWesternDigits("٢:٢٨٦")).toBe("2:286");
  });
});

describe("OCR cleaning", () => {
  it("removes social media chrome but keeps content and references", () => {
    const raw = ["9:41", "Liked by someone and others", "O Allah, guide me", "(Quran 1:6)", "1,204 likes", "#dua #reminder"].join("\n");
    const r = cleanOcrText(raw);
    expect(r.lines.map((l) => l.text)).toEqual(["O Allah, guide me", "(Quran 1:6)"]);
    expect(r.removed).toContain("Liked by someone and others");
    expect(r.hashtags).toEqual(["dua", "reminder"]);
  });

  it("drops bare engagement counts but keeps numbered content", () => {
    const r = cleanOcrText(["12.4K", "318", "1. O Allah, guide me"].join("\n"));
    expect(r.lines.map((l) => l.text)).toEqual(["1. O Allah, guide me"]);
  });

  it("drops usernames and stray icon misreads", () => {
    const r = cleanOcrText(["0 quiet.reminders", "quiet.reminders Follow", "ور", "O Allah, guide me", "My Lord"].join("\n"));
    expect(r.lines.map((l) => l.text)).toEqual(["O Allah, guide me", "My Lord"]);
  });

  it("never rewrites words", () => {
    const raw = "Thsi has a typo  and   extra spaces";
    expect(cleanOcrText(raw).lines[0].text).toBe("Thsi has a typo and extra spaces");
  });
});

describe("segmentation", () => {
  it("keeps Arabic + translation + source together", () => {
    const { lines } = cleanOcrText([verse(20, 25).text, "", "My Lord, expand for me my breast", "Surah Taha 20:25"].join("\n"));
    const segs = segmentLines(lines);
    expect(segs).toHaveLength(1);
    expect(segs[0].arabic).toBe(verse(20, 25).text);
    expect(segs[0].english).toBe("My Lord, expand for me my breast");
    expect(segs[0].source).toBe("Surah Taha 20:25");
  });

  it("splits multiple numbered items", () => {
    const text = [
      `1. ${verse(94, 5).text}`,
      "For indeed, with hardship will be ease.",
      "",
      `2. ${verse(94, 6).text}`,
      "Indeed, with hardship will be ease.",
    ].join("\n");
    const segs = segmentLines(cleanOcrText(text).lines);
    expect(segs).toHaveLength(2);
  });

  it("splits Arabic/English/Arabic/English pairs", () => {
    const text = [verse(1, 6).text, "", "Guide us", "", verse(20, 25).text, "", "Expand my chest"].join("\n");
    expect(segmentLines(cleanOcrText(text).lines)).toHaveLength(2);
  });
});

describe("claimed reference parsing", () => {
  it("parses Quran references in common formats", () => {
    expect(parseClaimedReferences("Surah Al-Baqarah 2:286")[0]).toMatchObject({ kind: "quran", surah: 2, ayahStart: 286 });
    expect(parseClaimedReferences("[94:5-6]")[0]).toMatchObject({ kind: "quran", surah: 94, ayahStart: 5, ayahEnd: 6 });
    expect(parseClaimedReferences("(Quran ٢٠:٢٥)")[0]).toMatchObject({ kind: "quran", surah: 20, ayahStart: 25 });
  });

  it("ignores clock times and impossible references", () => {
    expect(parseClaimedReferences("posted at 9:41 am")).toEqual([]);
    expect(parseClaimedReferences("Quran 200:5")).toEqual([]);
  });

  it("parses hadith collection citations without inventing numbers", () => {
    expect(parseClaimedReferences("Sahih al-Bukhari 6306")[0]).toMatchObject({ kind: "hadith", collection: "Sahih al-Bukhari", number: "6306" });
    expect(parseClaimedReferences("Reported by Tirmidhi")[0]).toMatchObject({ kind: "hadith", collection: "Jami at-Tirmidhi", number: null });
  });
});
