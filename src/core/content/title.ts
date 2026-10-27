import type { ContentType } from "../types";
import { getTypeDefinition, subcategoryLabel } from "../taxonomy";

function firstWords(text: string, max = 8): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0];
  const words = firstSentence.split(" ");
  const out = words.slice(0, max).join(" ").replace(/[,:;\-–]+$/, "");
  return words.length > max ? `${out}…` : out;
}

/** Deterministic, descriptive title. Never invents a reference. */
export function suggestTitle(args: {
  contentType: ContentType;
  subcategory: string;
  english: string;
  arabic: string;
  referenceLabel?: string;
}): string {
  const { contentType, subcategory, english, arabic, referenceLabel } = args;
  const def = getTypeDefinition(contentType);
  switch (contentType) {
    case "dua":
      return subcategory === "other"
        ? firstWords(english, 7) || "Dua"
        : `Dua for ${subcategoryLabel(contentType, subcategory).toLowerCase()}`;
    case "adhkar":
      return subcategory === "daily" ? firstWords(english, 6) || "Daily dhikr" : `${subcategoryLabel(contentType, subcategory)} adhkar`;
    case "quran":
      return referenceLabel ?? (firstWords(english, 7) || "Quranic verse");
    default:
      return firstWords(english, 8) || firstWords(arabic, 6) || def.singular;
  }
}
