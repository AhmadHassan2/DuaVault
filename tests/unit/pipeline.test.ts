import { describe, expect, it } from "vitest";
import { processScreenshot, processText, reanalyzeDraft, type OcrEngine, type PipelineStep } from "@/core/pipeline/pipeline";
import { RuleBasedClassifier } from "@/core/classify/classifier";
import type { ReferenceProvider } from "@/core/verify/verify";
import { makeItem, quranMatcher, verse } from "./helpers";

const references: ReferenceProvider = {
  getQuranMatcher: async () => quranMatcher,
  getReferenceMatcher: async () => null,
};

function deps(existing = [makeItem({ id: "old", title: "Old", arabicText: verse(20, 25).text })]) {
  const steps: PipelineStep[] = [];
  return {
    steps,
    deps: {
      classifier: new RuleBasedClassifier(),
      references,
      existingItems: async () => existing,
      onStep: (s: PipelineStep) => steps.push(s),
    },
  };
}

/** Test double: returns fixed text, standing in for Tesseract in unit tests only. */
function fixedOcr(text: string, confidence = 90): OcrEngine {
  return {
    id: "fixed-test",
    recognize: async () => ({ text, confidence, lines: text.split("\n").map((t) => ({ text: t, confidence })), engine: "fixed-test" }),
  };
}

describe("pipeline", () => {
  it("runs the full screenshot flow and reports steps in order", async () => {
    const { deps: d, steps } = deps();
    const r = await processScreenshot(
      null,
      fixedOcr([verse(20, 25).text, "", "My Lord, expand for me my breast", "Surah Taha 20:25"].join("\n")),
      d,
    );
    expect(steps.filter((s, i) => steps.indexOf(s) === i)).toEqual(["reading", "identifying", "organizing", "ready"]);
    expect(r.drafts).toHaveLength(1);
    const draft = r.drafts[0];
    expect(draft.verification.status).toBe("verified_match");
    expect(draft.contentType).toBe("dua");
    expect(draft.duplicates[0]?.id).toBe("old");
    expect(draft.transliteration).toBeNull();
  });

  it("warns about low OCR confidence and flags weak lines", async () => {
    const { deps: d } = deps([]);
    const r = await processScreenshot(null, fixedOcr("O Allah, forgive me", 40), d);
    expect(r.warnings.join(" ")).toMatch(/confidence is low/);
    expect(r.drafts[0].lowConfidenceLines).toEqual(["O Allah, forgive me"]);
  });

  it("returns a helpful warning when no text is found", async () => {
    const { deps: d } = deps([]);
    const r = await processScreenshot(null, fixedOcr("", 0), d);
    expect(r.drafts).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/No readable text/);
  });

  it("processes typed text and re-analyses edits", async () => {
    const { deps: d } = deps([]);
    const r = await processText("Be patient, Allah is with those who are patient. Reminder.", d);
    expect(r.drafts[0].contentType).toBe("reminder");
    const edited = await reanalyzeDraft({ ...r.drafts[0], arabicText: verse(94, 5).text, sourceText: "Quran 94:5" }, d);
    expect(edited.verification.status).toBe("verified_match");
    expect(edited.draftId).toBe(r.drafts[0].draftId);
  });
});
