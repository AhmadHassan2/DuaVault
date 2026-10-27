/**
 * Encodes the recorded frames (demo/out/frames) to an H.264 MP4 that plays
 * in QuickTime, VS Code and on phones. Uses the WebCodecs H.264 encoder of
 * the locally installed Google Chrome — no ffmpeg install needed.
 *
 *   node demo/to-mp4.mjs   → demo/out/duavault-demo.mp4
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "out");
const FRAMES = join(OUT, "frames");
const FPS = 30;
const PORT = 4174;

const index = JSON.parse(await readFile(join(FRAMES, "index.json"), "utf8"));
const order = index.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t);
const start = order[0].t;
const end = order[order.length - 1].t;
// Constant-rate schedule: for each output frame, the latest captured frame at that time.
const schedule = [];
for (let n = 0, k = 0; n <= Math.ceil((end - start) * FPS); n++) {
  const t = start + n / FPS;
  while (k + 1 < order.length && order[k + 1].t <= t) k++;
  schedule.push(order[k].i);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end("<!doctype html><title>encode</title>");
  }
  try {
    const body = await readFile(join(FRAMES, url.pathname.slice(1)));
    res.writeHead(200, { "content-type": "image/jpeg" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.js" });
  const base64 = await page.evaluate(
    async ({ schedule, fps }) => {
      const width = 1920;
      const height = 1080;
      const config = { codec: "avc1.640028", width, height, bitrate: 8_000_000, framerate: fps };
      const support = await VideoEncoder.isConfigSupported(config);
      if (!support.supported) throw new Error("This Chrome can't encode H.264");
      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: { codec: "avc", width, height, frameRate: fps },
        fastStart: "in-memory",
      });
      let failure = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => (failure = e),
      });
      encoder.configure(config);
      const cache = new Map();
      const load = async (i) => {
        if (!cache.has(i)) {
          const blob = await (await fetch(`/${String(i).padStart(5, "0")}.jpg`)).blob();
          cache.clear();
          cache.set(i, await createImageBitmap(blob));
        }
        return cache.get(i);
      };
      for (let n = 0; n < schedule.length; n++) {
        if (failure) throw failure;
        const bitmap = await load(schedule[n]);
        const frame = new VideoFrame(bitmap, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
        encoder.encode(frame, { keyFrame: n % (fps * 2) === 0 });
        frame.close();
        while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      }
      await encoder.flush();
      muxer.finalize();
      const u8 = new Uint8Array(muxer.target.buffer);
      let bin = "";
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { schedule, fps: FPS },
  );
  const file = join(OUT, "duavault-demo.mp4");
  const bytes = Buffer.from(base64, "base64");
  await writeFile(file, bytes);
  console.log(`✓ ${file} (${(schedule.length / FPS).toFixed(1)}s, ${(bytes.length / 1e6).toFixed(1)} MB)`);
} finally {
  await browser.close();
  server.close();
}
