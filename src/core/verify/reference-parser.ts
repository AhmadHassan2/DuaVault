import { toWesternDigits } from "../text/arabic";

export type ClaimedReference =
  | {
      kind: "quran";
      surah: number;
      ayahStart: number;
      ayahEnd: number;
      raw: string;
    }
  | {
      kind: "hadith";
      collection: string;
      number: string | null;
      raw: string;
    };

/** Canonical collection names with the spellings commonly seen in posts. */
const HADITH_COLLECTIONS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Sahih al-Bukhari", pattern: /\b(?:sahih\s+)?(?:al[-\s]?)?bukh[aā]r[iī]\b/i },
  { name: "Sahih Muslim", pattern: /\b(?:sahih\s+)?muslim\b(?=\s*(?:no\.?|#|number|hadith|\d|,|\)|\]|$))/i },
  { name: "Jami at-Tirmidhi", pattern: /\b(?:jami[`'’]?\s+)?(?:at[-\s]?|al[-\s]?)?tirmi[dz]h?[iī]\b/i },
  { name: "Sunan Abi Dawud", pattern: /\b(?:sunan\s+)?ab[iu]\s*da[wo]{1,2}u?d\b/i },
  { name: "Sunan an-Nasa'i", pattern: /\b(?:sunan\s+)?(?:an[-\s]?)?nasa[`'’]?[iī]\b/i },
  { name: "Sunan Ibn Majah", pattern: /\b(?:sunan\s+)?ibn\s*maja[h]?\b/i },
  { name: "Musnad Ahmad", pattern: /\bmusnad\s+(?:imam\s+)?ahmad\b/i },
  { name: "Muwatta Malik", pattern: /\bmuwatt?a[`'’]?\b/i },
  { name: "Riyad as-Salihin", pattern: /\briya[dz]h?\s*(?:as|us)?[-\s]?sal[iea]h[iea]+n\b/i },
  { name: "Hisn al-Muslim", pattern: /\b(?:hisn|hisnul|fortress of the muslim)\b/i },
  { name: "Al-Adab Al-Mufrad", pattern: /\badab\s+al[-\s]?mufrad\b/i },
  { name: "Bulugh al-Maram", pattern: /\bbul[uo]gh\s+al[-\s]?maram\b/i },
  { name: "Sunan ad-Darimi", pattern: /\bdarimi\b/i },
];

const NUMBER_AFTER = /^[\s,:.\-–]*(?:vol\.?\s*\d+\s*[,;]?\s*)?(?:book\s*\d+\s*[,;]?\s*)?(?:hadith|no\.?|number|#|n°)?\s*[:.]?\s*(\d{1,5}[a-z]?)/i;

function quranFromNumbers(s: string, a: string, b: string | undefined, raw: string): ClaimedReference | null {
  const surah = Number(s);
  const ayahStart = Number(a);
  const ayahEnd = b ? Number(b) : ayahStart;
  if (surah < 1 || surah > 114 || ayahStart < 1 || ayahStart > 286 || ayahEnd < ayahStart || ayahEnd > 286) {
    return null;
  }
  return { kind: "quran", surah, ayahStart, ayahEnd, raw: raw.trim() };
}

/**
 * Extracts references *claimed* in the text. A claimed reference is only a
 * pointer for verification — it never makes content "verified" by itself.
 */
export function parseClaimedReferences(input: string): ClaimedReference[] {
  const text = toWesternDigits(input);
  const out: ClaimedReference[] = [];

  // Quran: "Quran 2:286", "Surah Al-Baqarah 2:286", "[2:255]", "(Al-Imran 3:8)", "Q 94:5-6"
  const quranPatterns = [
    /\b(?:qur[`'’]?an|quran|koran|surah?|surat|sura|q)\b[^\d\n]{0,40}?(\d{1,3})\s*[:：.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/gi,
    /[[(]\s*(?:[A-Za-z][A-Za-z'’\-\s]{0,30})?(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[\])]/g,
    /\b(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/g,
  ];
  const seen = new Set<string>();
  for (const re of quranPatterns) {
    for (const m of text.matchAll(re)) {
      // The bare "x:y" pattern is only trusted when the line looks like a reference, not a time.
      if (re === quranPatterns[2]) {
        const line = lineAround(text, m.index ?? 0);
        if (/\b(am|pm)\b/i.test(line) || !/(qur|surah|sura|ayah|ayat|verse|allah|[\[(])/i.test(line)) continue;
      }
      const ref = quranFromNumbers(m[1], m[2], m[3], m[0]);
      if (!ref || ref.kind !== "quran") continue;
      const key = `${ref.surah}:${ref.ayahStart}-${ref.ayahEnd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }

  for (const { name, pattern } of HADITH_COLLECTIONS) {
    const m = pattern.exec(text);
    if (!m) continue;
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40);
    const num = NUMBER_AFTER.exec(after);
    out.push({
      kind: "hadith",
      collection: name,
      number: num ? num[1] : null,
      raw: (m[0] + (num ? after.slice(0, (num.index ?? 0) + num[0].length) : "")).trim(),
    });
  }
  return out;
}

function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end);
}

/** True when a line is mostly a citation (so it can be split off as the source). */
export function looksLikeSourceLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^(source|reference|ref|narrated in|reported in|recorded in|collected by|graded|grade)\b\s*[:\-]?/i.test(t)) return true;
  if (/^[\[(\-–—~]/.test(t) && parseClaimedReferences(t).length > 0 && t.length < 90) return true;
  return parseClaimedReferences(t).length > 0 && t.length < 60;
}

export function formatClaimedReference(ref: ClaimedReference): string {
  if (ref.kind === "quran") {
    return ref.ayahEnd !== ref.ayahStart
      ? `Quran ${ref.surah}:${ref.ayahStart}-${ref.ayahEnd}`
      : `Quran ${ref.surah}:${ref.ayahStart}`;
  }
  return ref.number ? `${ref.collection} ${ref.number}` : ref.collection;
}
