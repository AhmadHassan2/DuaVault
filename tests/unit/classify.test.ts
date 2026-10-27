import { describe, expect, it } from "vitest";
import { RuleBasedClassifier, CompositeClassifier, type ClassificationInput } from "@/core/classify/classifier";
import { detectTopics } from "@/core/classify/tagger";
import { parseClaimedReferences } from "@/core/verify/reference-parser";
import { quranMatcher, verse } from "./helpers";

const classifier = new RuleBasedClassifier();

function input(arabic: string, english: string, sourceText = ""): ClassificationInput {
  return {
    arabic,
    english,
    sourceText,
    claimed: parseClaimedReferences(`${sourceText}\n${english}`),
    quranMatch: arabic ? quranMatcher.match(arabic) : null,
    referenceMatch: null,
  };
}

// Synthetic sample texts for the rules. These are not presented as authentic sources.
describe("RuleBasedClassifier", () => {
  it("classifies a non-supplication Quran verse as Quran", () => {
    const r = classifier.classify(input(verse(94, 5).text, "For indeed, with hardship will be ease.", "Quran 94:5"));
    expect(r.contentType).toBe("quran");
    expect(r.subcategory).toBe("verses");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("files a Quranic supplication under Duas", () => {
    const r = classifier.classify(input(verse(20, 25).text, "My Lord, expand for me my breast"));
    expect(r.contentType).toBe("dua");
  });

  it("recognises hadith narration phrasing", () => {
    const r = classifier.classify(
      input("", "Narrated Abu Hurairah: The Prophet ﷺ said, “The strong man is not the one who wrestles…”", "Sahih al-Bukhari"),
    );
    expect(r.contentType).toBe("hadith");
    expect(r.subcategory).toBe("unverified");
  });

  it("recognises morning adhkar", () => {
    const r = classifier.classify(input("أصبحنا وأصبح الملك لله", "Morning adhkar — recite once in the morning"));
    expect(r.contentType).toBe("adhkar");
    expect(r.subcategory).toBe("morning");
  });

  it("treats English advice as a reminder with a topic subcategory", () => {
    const r = classifier.classify(
      input("", "Reminder: when you feel overwhelmed, remember that Allah's plan is better than yours. Trust Allah and have patience."),
    );
    expect(r.contentType).toBe("reminder");
    expect(["tawakkul", "sabr"]).toContain(r.subcategory);
  });

  it("recognises Islamic history lessons", () => {
    const r = classifier.classify(input("", "Did you know? The Battle of Badr took place in the second year after the Hijrah. A lesson in history."));
    expect(r.contentType).toBe("knowledge");
    expect(r.subcategory).toBe("history");
  });

  it("assigns a dua subcategory from topics", () => {
    const r = classifier.classify(input("اللهم اغفر لي", "O Allah, forgive me"));
    expect(r.contentType).toBe("dua");
    expect(r.subcategory).toBe("forgiveness");
    expect(r.tags).toContain("forgiveness");
  });

  it("adds known topics from hashtags", () => {
    const r = classifier.classify({ ...input("اللهم اغفر لي", "O Allah, forgive me"), hashtags: ["morning", "fyp"] });
    expect(r.tags).toContain("morning");
    expect(r.tags).not.toContain("fyp");
  });

  it("reports low confidence when there are no signals", () => {
    const r = classifier.classify(input("", "Lorem ipsum"));
    expect(r.confidence).toBeLessThan(0.3);
  });
});

describe("CompositeClassifier", () => {
  it("delegates to a single strategy unchanged", async () => {
    const c = new CompositeClassifier([{ strategy: classifier, weight: 1 }]);
    const r = await c.classify(input("اللهم اغفر لي", "O Allah, forgive me"));
    expect(r.contentType).toBe("dua");
  });
});

describe("topic tagger", () => {
  it("finds topics from English and Arabic keywords", () => {
    const slugs = detectTopics("", "A dua for my parents and for travel").map((t) => t.slug);
    expect(slugs).toEqual(expect.arrayContaining(["family", "travel"]));
  });
});
