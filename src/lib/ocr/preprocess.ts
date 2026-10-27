"use client";

const MIN_WIDTH = 1400;
const MAX_PIXELS = 12_000_000;

/**
 * Light, local image preparation that reliably helps Tesseract on phone
 * screenshots: upscale small images, convert to grayscale, stretch contrast,
 * and invert dark-mode screenshots (light text on dark background).
 * Falls back to the original file if the browser can't decode it.
 */
export async function preprocessImage(file: Blob): Promise<Blob | HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  let scale = bitmap.width < MIN_WIDTH ? Math.min(3, MIN_WIDTH / bitmap.width) : 1;
  if (bitmap.width * bitmap.height * scale * scale > MAX_PIXELS) {
    scale = Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height));
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return file;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // Percentile-based contrast stretch.
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0, i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc > total * 0.01) {
      lo = i;
      break;
    }
  }
  for (let acc = 0, i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc > total * 0.01) {
      hi = i;
      break;
    }
  }
  let mean = 0;
  for (let i = 0; i < 256; i++) mean += i * hist[i];
  mean /= total;
  const invert = mean < 110; // dark-mode screenshot
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    let v = ((d[i] - lo) * 255) / range;
    v = Math.max(0, Math.min(255, v));
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
