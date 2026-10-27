"use client";

import { CompositeClassifier, RuleBasedClassifier } from "@/core/classify/classifier";
import type { PipelineDeps, PipelineStep } from "@/core/pipeline/pipeline";
import { getRepository } from "@/lib/data/repository";
import { getReferenceProvider } from "@/lib/references/static-provider";
import { TesseractOcrEngine } from "@/lib/ocr/tesseract-engine";

// Only the on-device rule-based strategy ships. Additional strategies (e.g. a
// local model) can be registered here without touching the UI.
const classifier = new CompositeClassifier([{ strategy: new RuleBasedClassifier(), weight: 1 }]);

let ocr: TesseractOcrEngine | null = null;
export function getOcrEngine(): TesseractOcrEngine {
  ocr ??= new TesseractOcrEngine("ara+eng");
  return ocr;
}

export function pipelineDeps(onStep?: (step: PipelineStep, detail?: string) => void): PipelineDeps {
  return {
    classifier,
    references: getReferenceProvider(),
    existingItems: () => getRepository().listItems(),
    onStep,
  };
}
