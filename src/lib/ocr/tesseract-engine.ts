"use client";

import type { OcrEngine, OcrLine, OcrResult } from "@/core/pipeline/pipeline";
import { countArabicLetters, countLatinLetters } from "@/core/text/arabic";
import { config } from "@/lib/config";
import { preprocessImage } from "./preprocess";

type Tesseract = typeof import("tesseract.js");
type TesseractWorker = Awaited<ReturnType<Tesseract["createWorker"]>>;
type Bbox = { x0: number; y0: number; x1: number; y1: number };

export type OcrLanguages = "ara+eng" | "eng" | "ara";

interface LayoutLine extends OcrLine {
  bbox: Bbox;
  paragraph: number;
}

/**
 * Browser OCR with Tesseract.js. Images are processed on-device; only the
 * engine and language data files are downloaded (from jsDelivr unless
 * self-hosted paths are configured).
 *
 * Two passes: a combined Arabic+English pass finds the layout and reads Latin
 * text, then every line containing Arabic is re-read with an Arabic-only
 * model. The combined model often turns Arabic glyphs into Latin junk on
 * stylised posts; the focused pass is noticeably cleaner.
 */
export class TesseractOcrEngine implements OcrEngine {
  readonly id = "tesseract.js";
  private workers = new Map<string, Promise<TesseractWorker>>();
  private progress: ((f: number) => void) | null = null;

  constructor(private readonly languages: OcrLanguages = "ara+eng") {}

  private getWorker(langs: string): Promise<TesseractWorker> {
    let w = this.workers.get(langs);
    if (!w) {
      w = (async () => {
        const { createWorker, OEM, PSM } = await import("tesseract.js");
        const worker = await createWorker(langs.split("+"), OEM.LSTM_ONLY, {
          ...(config.tesseract.langPath ? { langPath: config.tesseract.langPath } : {}),
          ...(config.tesseract.workerPath ? { workerPath: config.tesseract.workerPath } : {}),
          ...(config.tesseract.corePath ? { corePath: config.tesseract.corePath } : {}),
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text" && langs === this.languages) this.progress?.(m.progress * 0.7);
          },
        });
        await worker.setParameters({
          tessedit_pageseg_mode: langs === this.languages ? PSM.AUTO : PSM.SINGLE_BLOCK,
          preserve_interword_spaces: "1",
        });
        return worker;
      })();
      w.catch(() => this.workers.delete(langs));
      this.workers.set(langs, w);
    }
    return w;
  }

  /** Starts downloading the engine + language data ahead of time. */
  warmUp(): void {
    void this.getWorker(this.languages).catch(() => undefined);
  }

  async recognize(image: unknown, onProgress?: (fraction: number) => void): Promise<OcrResult> {
    if (!(image instanceof Blob)) throw new Error("Expected an image file");
    const worker = await this.getWorker(this.languages);
    const prepared = await preprocessImage(image);
    this.progress = onProgress ?? null;
    try {
      const { data } = await worker.recognize(prepared, {}, { text: true, blocks: true });
      const lines: LayoutLine[] = [];
      let paragraph = 0;
      for (const b of data.blocks ?? []) {
        for (const p of b.paragraphs) {
          for (const l of p.lines) {
            const text = l.text.trim();
            if (text) lines.push({ text, confidence: l.confidence, bbox: l.bbox, paragraph });
          }
          paragraph++;
        }
      }
      if (!lines.length) return { text: data.text, confidence: data.confidence, lines: [], engine: this.engineName() };

      if (this.languages.includes("ara")) {
        const merged = await this.sparseArabicPass(prepared, lines, onProgress);
        if (!merged) await this.refineArabicLines(prepared, lines, onProgress);
      }

      // Rebuild the text, keeping paragraph breaks so segmentation can use them.
      const parts: string[] = [];
      lines.forEach((l, i) => {
        if (i > 0 && l.paragraph !== lines[i - 1].paragraph) parts.push("");
        parts.push(l.text);
      });
      const confidence = lines.reduce((s, l) => s + l.confidence, 0) / lines.length;
      return {
        text: parts.join("\n"),
        confidence,
        lines: lines.map(({ text, confidence: c }) => ({ text, confidence: c })),
        engine: this.engineName(),
      };
    } finally {
      this.progress = null;
    }
  }

  /**
   * Large, fully-vowelled Arabic on social posts is often skipped or garbled
   * by the combined pass. An Arabic-only pass in sparse-text mode reads it far
   * better, and works best when glyphs aren't huge — so it runs at full and
   * half scale and keeps whichever reads more confident Arabic. Its rows then
   * replace the mixed-script misreads from the first pass. Returns false when
   * it found nothing usable.
   */
  private async sparseArabicPass(image: Blob | HTMLCanvasElement, lines: LayoutLine[], onProgress?: (f: number) => void): Promise<boolean> {
    if (!(image instanceof HTMLCanvasElement)) return false;
    const worker = await this.getWorker("ara");
    const { PSM } = await import("tesseract.js");
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    try {
      const scales = image.width > 900 ? [1, 0.5] : [1];
      let best: { rows: LayoutLine[]; score: number } = { rows: [], score: 0 };
      for (const [i, scale] of scales.entries()) {
        const input = scale === 1 ? image : scaledCanvas(image, scale);
        const { data } = await worker.recognize(input, {}, { blocks: true });
        const found: LayoutLine[] = [];
        for (const b of data.blocks ?? []) {
          for (const p of b.paragraphs) {
            for (const l of p.lines) {
              const text = l.text.trim();
              if (countArabicLetters(text) < 3 || arabicShare(text) < 0.75 || arabicDensity(text) < 0.6 || l.confidence < 35) continue;
              found.push({
                text,
                confidence: l.confidence,
                bbox: { x0: l.bbox.x0 / scale, y0: l.bbox.y0 / scale, x1: l.bbox.x1 / scale, y1: l.bbox.y1 / scale },
                paragraph: 0,
              });
            }
          }
        }
        const score = found.reduce((s, l) => s + (l.confidence / 100) * countArabicLetters(l.text), 0);
        if (score > best.score) best = { rows: found, score };
        onProgress?.(0.7 + (0.3 * (i + 1)) / scales.length);
      }
      if (!best.rows.length) return false;

      // A row that sits on confidently-read Latin text (e.g. "Following · For you") is a misread.
      const rows = groupRows(best.rows).filter(
        (r) => !lines.some((l) => verticalOverlap(r.bbox, l.bbox) > 0.5 && arabicShare(l.text) < 0.1 && l.confidence >= 80),
      );
      if (!rows.length) return false;
      // Drop first-pass lines that sit on an Arabic row and look like misreads.
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        const share = arabicShare(l.text);
        const onRow = rows.some((r) => verticalOverlap(r.bbox, l.bbox) > 0.5);
        const mixedJunk = share > 0.1 && share < 0.9 && l.confidence < 85;
        if ((onRow && (share > 0.2 || l.confidence < 70)) || mixedJunk) lines.splice(i, 1);
      }
      // Rows close together form one Arabic paragraph.
      let block = 100_000;
      rows.forEach((r, i) => {
        const prev = rows[i - 1];
        if (prev && r.bbox.y0 - prev.bbox.y1 > (r.bbox.y1 - r.bbox.y0) * 1.5) block++;
        r.paragraph = block;
      });
      lines.push(...rows);
      lines.sort((a, b) => a.bbox.y0 - b.bbox.y0);
      return true;
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    }
  }

  private async refineArabicLines(image: Blob | HTMLCanvasElement, lines: LayoutLine[], onProgress?: (f: number) => void) {
    // Lines whose boxes overlap vertically are one visual line split by the layout pass:
    // merge them so the Arabic-only pass reads that region once.
    for (let i = lines.length - 1; i > 0; i--) {
      const a = lines[i - 1];
      const b = lines[i];
      const overlap = Math.min(a.bbox.y1, b.bbox.y1) - Math.max(a.bbox.y0, b.bbox.y0);
      const minHeight = Math.min(a.bbox.y1 - a.bbox.y0, b.bbox.y1 - b.bbox.y0);
      if (countArabicLetters(a.text) && countArabicLetters(b.text) && overlap > minHeight * 0.5) {
        a.bbox = {
          x0: Math.min(a.bbox.x0, b.bbox.x0),
          y0: Math.min(a.bbox.y0, b.bbox.y0),
          x1: Math.max(a.bbox.x1, b.bbox.x1),
          y1: Math.max(a.bbox.y1, b.bbox.y1),
        };
        a.text = `${a.text} ${b.text}`;
        a.confidence = Math.min(a.confidence, b.confidence);
        lines.splice(i, 1);
      }
    }
    const targets = lines.filter((l) => countArabicLetters(l.text) > 0);
    if (!targets.length) return;
    const arabic = await this.getWorker("ara");
    const width = image instanceof HTMLCanvasElement ? image.width : Infinity;
    const height = image instanceof HTMLCanvasElement ? image.height : Infinity;
    for (const [i, line] of targets.entries()) {
      const pad = Math.round((line.bbox.y1 - line.bbox.y0) * 0.25);
      const left = Math.max(0, line.bbox.x0 - pad);
      const top = Math.max(0, line.bbox.y0 - pad);
      const rectangle = {
        left,
        top,
        width: Math.min(width, line.bbox.x1 + pad) - left,
        height: Math.min(height, line.bbox.y1 + pad) - top,
      };
      try {
        const { data } = await arabic.recognize(image, { rectangle });
        const text = data.text.replace(/\s*\n\s*/g, " ").trim();
        const before = arabicShare(line.text);
        const after = arabicShare(text);
        // Prefer the Arabic-only reading when it is cleaner or more confident.
        if (text && (after > before + 0.1 || data.confidence >= line.confidence)) {
          line.text = text;
          line.confidence = data.confidence;
        }
      } catch {
        // Keep the first-pass reading for this line.
      }
      onProgress?.(0.7 + (0.3 * (i + 1)) / targets.length);
    }
  }

  private engineName() {
    return `${this.id} (${this.languages}${this.languages.includes("ara") ? " + arabic pass" : ""})`;
  }

  async terminate(): Promise<void> {
    const all = [...this.workers.values()];
    this.workers.clear();
    await Promise.all(all.map(async (w) => (await w).terminate()));
  }
}

function scaledCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function verticalOverlap(a: Bbox, b: Bbox): number {
  const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return overlap / Math.max(1, Math.min(a.y1 - a.y0, b.y1 - b.y0));
}

/** Sparse mode returns word groups; join those on the same visual row, right to left. */
function groupRows(fragments: LayoutLine[]): LayoutLine[] {
  const sorted = [...fragments].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const rows: LayoutLine[][] = [];
  for (const f of sorted) {
    const row = rows.find((r) => verticalOverlap(r[0].bbox, f.bbox) > 0.5);
    if (row) row.push(f);
    else rows.push([f]);
  }
  return rows.map((row) => {
    row.sort((a, b) => b.bbox.x1 - a.bbox.x1);
    return {
      text: row.map((f) => f.text).join(" "),
      confidence: row.reduce((s, f) => s + f.confidence, 0) / row.length,
      bbox: {
        x0: Math.min(...row.map((f) => f.bbox.x0)),
        y0: Math.min(...row.map((f) => f.bbox.y0)),
        x1: Math.max(...row.map((f) => f.bbox.x1)),
        y1: Math.max(...row.map((f) => f.bbox.y1)),
      },
      paragraph: 0,
    };
  });
}

/** Arabic letters as a share of all visible characters (digits and symbols count against it). */
function arabicDensity(text: string): number {
  const visible = text.replace(/\s/g, "").length;
  return visible ? countArabicLetters(text) / visible : 0;
}

function arabicShare(text: string): number {
  const ar = countArabicLetters(text);
  const la = countLatinLetters(text);
  return ar + la ? ar / (ar + la) : 0;
}
