/**
 * Arabic text helpers.
 *
 * IMPORTANT: normalization here is used ONLY to build comparison keys for
 * matching and search. The text shown to users and stored as the item's
 * Arabic is never passed through these functions.
 */

// Harakat, Quranic annotation marks, superscript alef, etc.
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D3-\u08FF]/g;
const TATWEEL = /\u0640/g;
const ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u06FA-\u06FF]/;
const ARABIC_LETTER_G = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u06FA-\u06FF]/g;
const LATIN_LETTER_G = /[A-Za-z]/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

export function hasArabic(text: string): boolean {
  return ARABIC_LETTER.test(text);
}

export function countArabicLetters(text: string): number {
  return text.match(ARABIC_LETTER_G)?.length ?? 0;
}

export function countLatinLetters(text: string): number {
  return text.match(LATIN_LETTER_G)?.length ?? 0;
}

export type Script = "arabic" | "latin" | "mixed" | "none";

export function detectScript(text: string): Script {
  const ar = countArabicLetters(text);
  const la = countLatinLetters(text);
  if (ar === 0 && la === 0) return "none";
  if (ar === 0) return "latin";
  if (la === 0) return "arabic";
  const ratio = ar / (ar + la);
  if (ratio >= 0.8) return "arabic";
  if (ratio <= 0.2) return "latin";
  return "mixed";
}

export function toWesternDigits(text: string): string {
  return text.replace(ARABIC_INDIC_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, "").replace(TATWEEL, "");
}

/**
 * Produces a comparison key: no diacritics, folded letter variants, only
 * Arabic letters and single spaces.
 */
export function normalizeArabic(text: string): string {
  return stripDiacritics(text)
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, "\u0627") // آ أ إ ٱ → ا
    .replace(/\u0649/g, "\u064A") // ى → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/\u0624/g, "\u0648") // ؤ → و
    .replace(/\u0626/g, "\u064A") // ئ → ي
    .replace(/\u06CC/g, "\u064A") // Persian ya → ي
    .replace(/\u06A9/g, "\u0643") // Persian kaf → ك
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .replace(/\u0621/g, "") // standalone hamza is inconsistently written; drop it
    .replace(/\s+/g, " ")
    .trim();
}

export function arabicTokens(text: string): string[] {
  const n = normalizeArabic(text);
  return n ? n.split(" ").filter((t) => t.length > 0) : [];
}
