const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "by",
  "from", "is", "am", "are", "was", "were", "be", "been", "being", "it", "its", "this",
  "that", "these", "those", "i", "im", "me", "my", "we", "us", "our", "you", "your",
  "he", "him", "his", "she", "her", "they", "them", "their", "as", "so", "if", "then",
  "than", "do", "does", "did", "have", "has", "had", "not", "no", "can", "could",
  "would", "should", "will", "just", "about", "some", "something", "any", "what",
  "when", "how", "want", "need", "feel", "feeling", "really", "very", "into", "up",
  "all", "also", "there", "here", "show", "find", "give", "get",
]);

/** Lower-cases and strips punctuation for comparison keys. Never used for display. */
export function normalizeEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very small suffix stripper — enough to match "studying" with "study". */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ings", "ing", "ies", "ied", "ness", "fully", "ful", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, -suffix.length);
      if (suffix === "ies" || suffix === "ied") return base + "y";
      return base;
    }
  }
  return word;
}

export function englishTokens(text: string, { keepStopwords = false } = {}): string[] {
  const n = normalizeEnglish(text);
  if (!n) return [];
  return n
    .split(" ")
    .filter((t) => t.length > 1 && (keepStopwords || !STOPWORDS.has(t)))
    .map(stem);
}
