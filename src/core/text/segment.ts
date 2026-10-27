import type { CleanLine } from "./clean";
import { looksLikeSourceLine } from "../verify/reference-parser";

export interface Segment {
  arabic: string;
  english: string;
  source: string;
  /** Lines (in order) that formed the segment, for provenance. */
  lines: CleanLine[];
  /** Average OCR confidence of the lines, when known (0..100). */
  confidence: number | null;
}

const NUMBERED = /^\s*(?:\(?\s*(?:\d{1,2}|[٠-٩]{1,2})\s*[).\-–:]|[•●▪◆✦]\s)/;

interface Block {
  lines: CleanLine[];
  numbered: boolean;
}

function toBlocks(lines: CleanLine[]): Block[] {
  const blocks: Block[] = [];
  let current: CleanLine[] = [];
  const flush = () => {
    if (current.length) blocks.push({ lines: current, numbered: NUMBERED.test(current[0].text) });
    current = [];
  };
  for (const line of lines) {
    if (line.text === "") {
      flush();
      continue;
    }
    // A numbered line always starts a new block.
    if (NUMBERED.test(line.text) && current.length) flush();
    current.push(line);
  }
  flush();
  return blocks;
}

function blockScript(block: Block): "arabic" | "latin" {
  let ar = 0;
  let la = 0;
  for (const l of block.lines) {
    if (l.script === "arabic") ar += l.text.length;
    else if (l.script === "latin") la += l.text.length;
    else if (l.script === "mixed") {
      ar += l.text.length / 2;
      la += l.text.length / 2;
    }
  }
  return ar >= la ? "arabic" : "latin";
}

function buildSegment(lines: CleanLine[]): Segment {
  const arabic: string[] = [];
  const english: string[] = [];
  const source: string[] = [];
  for (const l of lines) {
    if (l.script === "arabic") arabic.push(l.text);
    else if (looksLikeSourceLine(l.text)) source.push(l.text);
    else if (l.script === "mixed") {
      // Mixed lines are kept whole on the side that dominates; the user can move text in review.
      english.push(l.text);
    } else english.push(l.text);
  }
  const confs = lines.map((l) => l.confidence).filter((c): c is number => c !== null);
  return {
    arabic: arabic.join("\n"),
    english: english.join("\n"),
    source: source.join("\n"),
    lines,
    confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
  };
}

/**
 * Splits a screenshot's text into one or more content segments.
 *
 * Heuristics (deliberately simple and predictable):
 * - numbered blocks ("1.", "٢)", "•") each start a new segment;
 * - an Arabic block that follows a segment which already has a translation
 *   starts a new segment (Arabic → English → Arabic → English pattern);
 * - otherwise blocks are merged so a single dua with a long translation stays together.
 */
export function segmentLines(lines: CleanLine[]): Segment[] {
  const blocks = toBlocks(lines);
  if (!blocks.length) return [];

  const groups: CleanLine[][] = [];
  let current: CleanLine[] = [];
  let currentHasArabic = false;
  let currentHasEnglish = false;

  for (const block of blocks) {
    const script = blockScript(block);
    const startsNew =
      current.length > 0 &&
      (block.numbered || (script === "arabic" && currentHasArabic && currentHasEnglish));
    if (startsNew) {
      groups.push(current);
      current = [];
      currentHasArabic = false;
      currentHasEnglish = false;
    }
    current.push(...block.lines);
    if (script === "arabic") currentHasArabic = true;
    else if (!block.lines.every((l) => looksLikeSourceLine(l.text))) currentHasEnglish = true;
  }
  if (current.length) groups.push(current);

  const segments = groups.map(buildSegment);

  // A segment that is only a citation belongs to the previous segment.
  for (let i = segments.length - 1; i > 0; i--) {
    const s = segments[i];
    if (!s.arabic && !s.english && s.source) {
      const prev = segments[i - 1];
      prev.source = [prev.source, s.source].filter(Boolean).join("\n");
      prev.lines = [...prev.lines, ...s.lines];
      segments.splice(i, 1);
    }
  }
  return segments.filter((s) => s.arabic || s.english);
}
