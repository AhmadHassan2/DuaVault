import { detectScript, type Script } from "./arabic";

export interface CleanLine {
  text: string;
  script: Script;
  /** OCR confidence 0..100 when known. */
  confidence: number | null;
}

export interface CleanResult {
  lines: CleanLine[];
  /** Lines dropped as social-media UI noise — shown to the user, never silently lost. */
  removed: string[];
  hashtags: string[];
}

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

// Social media chrome that commonly appears in screenshots. Matched on whole lines only.
const NOISE_PATTERNS: RegExp[] = [
  /^(liked by|view all \d+ comments|view all comments|add a comment|follow|following|reply|replies|see translation|more|share|send|save|saved|reels?|sponsored|suggested for you|original audio)\b.*$/i,
  /^[\d,.]+\s*[km]?\s*(likes?|views?|comments?|shares?|followers?)$/i,
  /^[\d,.]+\s*[km]$/i, // bare engagement counts next to like/comment icons ("12.4K")
  /^\d{1,2}:\d{2}(\s*[ap]m)?$/i, // status bar clock
  /^(\d+|[•·]|\s)*\s*(lte|5g|4g|wifi)\b.*$/i,
  /^@[\w.]+$/, // lone username
  /^(\S{1,2}\s+)?@?[a-z0-9_]+[._][a-z0-9_.]+(\s+follow(ing)?)?$/i, // "quiet.reminders Follow" (avatar may read as a stray char)
  /^\d+\s*(s|m|h|d|w|y|min|mins|hr|hrs)\s*(ago)?$/i, // "2h", "3 d ago"
];

export function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Lines with no letters at all (e.g. "| —" OCR artefacts), keeping digits-with-colon refs like "2:255".
  if (!/[\p{L}]/u.test(t) && !/\d+\s*[:：]\s*\d+/.test(t)) return true;
  // One or two stray letters (icons misread as text), unless it's a numbered marker.
  if ((t.match(/\p{L}/gu)?.length ?? 0) <= 2 && !/\d/.test(t)) return true;
  return NOISE_PATTERNS.some((re) => re.test(t));
}

/**
 * Cleans OCR output conservatively: whitespace, zero-width characters and
 * obvious UI noise lines only. Words are never rewritten or "corrected".
 */
export function cleanOcrText(
  raw: string,
  lineConfidences?: Array<{ text: string; confidence: number }>,
): CleanResult {
  const confidenceByText = new Map<string, number>();
  for (const l of lineConfidences ?? []) {
    confidenceByText.set(l.text.replace(ZERO_WIDTH, "").replace(/\s+/g, " ").trim(), l.confidence);
  }

  const removed: string[] = [];
  const hashtags = new Set<string>();
  const lines: CleanLine[] = [];

  for (const rawLine of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const text = rawLine.replace(ZERO_WIDTH, "").replace(/[ \t]+/g, " ").trim();
    if (!text) {
      // Preserve paragraph breaks as empty lines (collapsed to one).
      if (lines.length && lines[lines.length - 1].text !== "") {
        lines.push({ text: "", script: "none", confidence: null });
      }
      continue;
    }
    const tagMatches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    tagMatches.forEach((h) => hashtags.add(h.slice(1).toLowerCase()));
    const withoutTags = text.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
    if (!withoutTags) {
      removed.push(text);
      continue;
    }
    if (isNoiseLine(withoutTags)) {
      removed.push(text);
      continue;
    }
    lines.push({
      text: withoutTags,
      script: detectScript(withoutTags),
      confidence: confidenceByText.get(text) ?? null,
    });
  }

  while (lines.length && lines[lines.length - 1].text === "") lines.pop();
  return { lines, removed, hashtags: [...hashtags] };
}
