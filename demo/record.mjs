/**
 * Records the DuaVault demo film.
 *
 *   pnpm dev                 # app on http://localhost:3000 (needs `pnpm fetch:quran` done)
 *   pnpm demo:record         # → demo/out/duavault-demo.webm
 *   pnpm demo:record --stills  # just render key frames to demo/out/stills/
 *
 * The reels feed and the train carriage are illustrations. Everything shown
 * inside DuaVault is the real app: real OCR, verification and saving.
 * The dua shown (Quran 20:25–28) is read verbatim from the Tanzil dataset.
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const ROOT = import.meta.dirname;
const OUT = join(ROOT, "out");
const APP = process.env.DEMO_APP_URL ?? "http://localhost:3000";
const PORT = 4173;
const FPS = 30;
const STILLS = process.argv.includes("--stills");
const ENCODE_ONLY = process.argv.includes("--encode-only");
const FRAMES_DIR = join(OUT, "frames");

if (ENCODE_ONLY) {
  const index = JSON.parse(await readFile(join(FRAMES_DIR, "index.json"), "utf8"));
  const frames = await Promise.all(index.map(async (t, i) => ({ t, buf: await readFile(join(FRAMES_DIR, `${String(i).padStart(5, "0")}.jpg`)) })));
  await encode(frames, join(OUT, "duavault-demo.webm"));
  process.exit(0);
}
const TITLE = "Dua of Musa (AS) for ease";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── data from the trusted dataset ────────────────────────────────────────────
const quran = JSON.parse(await readFile(join(ROOT, "../public/data/quran/quran.json"), "utf8"));
const verse = (s, a) => {
  const v = quran.verses.find((x) => x.surah === s && x.ayah === a);
  if (!v) throw new Error(`Missing ${s}:${a} — run pnpm fetch:quran`);
  return v;
};
const reelData = {
  verses: [25, 26, 27, 28].map((a) => ({ text: verse(20, a).text, translation: verse(20, a).translation })),
  label: "Surah Taha 20:25–28",
  notifBody: TITLE,
};

// ── static server for the film page ──────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/reel-data.json") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(reelData));
  }
  const file = join(ROOT, url.pathname === "/" ? "film.html" : url.pathname);
  try {
    const body = await readFile(file);
    const type = { ".html": "text/html", ".png": "image/png", ".js": "text/javascript" }[extname(file)] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "light", locale: "en-GB" });

try {
  await mkdir(OUT, { recursive: true });

  // ── 1. the "screenshot" a user would take (iPhone resolution) ──────────────
  const shotPage = await browser.newPage({ viewport: { width: 390, height: 868 }, deviceScaleFactor: 3 });
  await shotPage.goto(`http://localhost:${PORT}/film.html?only=reel`);
  await shotPage.waitForSelector("body[data-ready='1']");
  await sleep(300);
  const screenshot = await shotPage.screenshot();
  await shotPage.close();
  await writeFile(join(OUT, "reel-screenshot.png"), screenshot);
  console.log("✓ reel screenshot");

  // ── 2. seed the app's on-device library + warm up OCR ──────────────────────
  const seed = await context.newPage();
  seed.setDefaultTimeout(120_000);
  await seed.goto(`${APP}/home`);
  await seed.evaluate(
    () =>
      new Promise((r) => {
        const q = indexedDB.deleteDatabase("duavault");
        q.onsuccess = q.onerror = q.onblocked = () => r();
      }),
  );
  const seedTexts = [
    `${verse(2, 201).text}\n\n${verse(2, 201).translation}\nQuran 2:201`,
    `${verse(3, 8).text}\n\n${verse(3, 8).translation}\nQuran 3:8`,
    `${verse(94, 5).text}\n${verse(94, 6).text}\n\n${verse(94, 5).translation} ${verse(94, 6).translation}\nQuran 94:5-6`,
    "Reminder: when you feel overwhelmed, remember that Allah's plan is better than yours. Trust Him and keep going.",
  ];
  for (const text of seedTexts) {
    await seed.goto(`${APP}/add`);
    await seed.getByRole("tab", { name: /Type or paste/ }).click();
    await seed.getByTestId("manual-text").fill(text);
    await seed.getByRole("button", { name: /Organize this text/ }).click();
    await seed.getByRole("button", { name: /Save to library/ }).click();
    await seed.getByText("Saved to your library").first().waitFor();
  }
  // Put the first seeded dua into the memorization list so flashcards have a card.
  await seed.goto(`${APP}/library`);
  await seed.getByTestId("library-grid").getByRole("link").last().click();
  await seed.getByRole("combobox", { name: "Memorization status" }).click();
  await seed.getByRole("option", { name: "Learning" }).click();
  await seed.getByText(/Next review/).waitFor();

  // Run OCR once so the engine + language data are cached before filming.
  await seed.goto(`${APP}/add`);
  await seed.getByTestId("file-input").setInputFiles({ name: "IMG_2041.PNG", mimeType: "image/png", buffer: screenshot });
  await seed.getByTestId("draft-editor").first().waitFor({ timeout: 240_000 });
  await sleep(500);
  const warm = await seed.getByTestId("draft-editor").evaluateAll((els) =>
    els.map((el) => ({
      title: el.querySelector("input")?.value,
      arabic: el.querySelector("textarea[lang=ar]")?.value,
      english: el.querySelectorAll("textarea")[1]?.value,
      source: el.querySelectorAll("input")[1]?.value,
      status: el.querySelector("[data-testid=verification-panel]")?.textContent?.slice(0, 90),
      reminder: el.querySelector("[data-testid=reminder-control]")?.textContent,
    })),
  );
  const ignored = await seed.locator("details").first().textContent().catch(() => "");
  console.log("✓ OCR warm-up:", JSON.stringify({ drafts: warm, ignored }, null, 1));
  await seed.close();

  // ── 3. film ────────────────────────────────────────────────────────────────
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  await page.goto(`http://localhost:${PORT}/film.html`);
  await page.waitForSelector("body[data-ready='1']");
  const film = (fn, ...args) => page.evaluate(([f, a]) => window.film[f](...a), [fn, args]);
  const appFrame = () => page.frames().find((f) => f.url().startsWith(APP));
  const app = page.frameLocator("#app");
  const screenX = 1154;
  const screenY = 106;

  async function tap(locator, { hold = 120 } = {}) {
    console.log("  tap", locator.toString().slice(0, 140));
    await locator.scrollIntoViewIfNeeded({ timeout: 15_000 });
    const box = await locator.boundingBox();
    await film("touch", box.x + box.width / 2, box.y + box.height / 2, true);
    await sleep(650);
    await film("press", true);
    await sleep(hold);
    await locator.click({ timeout: 15_000 });
    await film("press", false);
    await sleep(250);
    await film("hideTouch");
  }
  async function swipeUp() {
    await film("touch", screenX + 200, screenY + 640, true);
    await sleep(350);
    await film("press", true);
    await film("touch", screenX + 200, screenY + 260, true);
    await sleep(250);
  }
  async function appScroll(top, wait = 900) {
    await appFrame().evaluate((t) => window.scrollTo({ top: t, behavior: "smooth" }), top);
    await sleep(wait);
  }
  async function appScrollTo(locator, offset = 120, wait = 1000) {
    const top = await locator.evaluate((el, o) => el.getBoundingClientRect().top + window.scrollY - o, offset);
    await appScroll(top, wait);
  }
  async function loadApp(path) {
    await film("appSrc", `${APP}${path}`);
    await page.waitForFunction((u) => document.querySelector("#app").contentWindow && true, APP);
    await sleep(400);
    await app.locator("main").waitFor();
    await sleep(800);
  }

  if (STILLS) {
    const dir = join(OUT, "stills");
    await mkdir(dir, { recursive: true });
    await film("title", titleHtml("intro"));
    await sleep(900);
    await page.screenshot({ path: join(dir, "0-title.png") });
    await film("hideTitle");
    await film("caption", "01", "Scrolling reels", "Between videos, a dua you want to keep.");
    await film("scrollFeed", 2);
    await sleep(1500);
    await page.screenshot({ path: join(dir, "1-reel.png") });
    await film("phone", false);
    await film("hideCaption");
    await film("train", true);
    await sleep(1200);
    await page.screenshot({ path: join(dir, "2-train.png") });
    await film("trainBuzz");
    await sleep(1200);
    await page.screenshot({ path: join(dir, "3-buzz.png") });
    await film("trainZoom");
    await sleep(1900);
    await page.screenshot({ path: join(dir, "4-zoom.png") });
    await film("train", false);
    await film("phone", true);
    await film("layer", "lock");
    await film("setTime", "7:30");
    await film("notify", true);
    await film("caption", "06", "Tap, and it's right there", "");
    await sleep(1000);
    await page.screenshot({ path: join(dir, "5-lock.png") });
    await film("title", titleHtml("outro"));
    await sleep(900);
    await page.screenshot({ path: join(dir, "6-outro.png") });
    console.log(`✓ stills → ${dir}`);
  } else {
    const frames = [];
    const cdp = await context.newCDPSession(page);
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      frames.push({ t: metadata.timestamp, buf: Buffer.from(data, "base64") });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    // Keep the compositor producing frames even when nothing moves.
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;z-index:9999";
      document.body.appendChild(d);
      (function tick() {
        d.style.transform = `translateX(${Math.random()}px)`;
        requestAnimationFrame(tick);
      })();
    });

    // Intro
    await film("title", titleHtml("intro"));
    await sleep(3200);
    await film("hideTitle");
    await film("setTime", "22:14");

    // 01 — reels
    await film("caption", "01", "Scrolling reels at night", "Between videos, a dua you want to keep.");
    await sleep(1800);
    await swipeUp();
    await film("scrollFeed", 1);
    await film("press", false);
    await film("hideTouch");
    await sleep(1700);
    await swipeUp();
    await film("scrollFeed", 2);
    await film("press", false);
    await film("hideTouch");
    await sleep(3400);

    // 02 — screenshot
    await film("caption", "02", "Screenshot it", "Like always. This time it won't get buried in your camera roll.");
    await sleep(900);
    await film("flash");
    await film("thumb", `data:image/png;base64,${screenshot.toString("base64")}`);
    await sleep(2200);

    // 03 — add to DuaVault (real app)
    await film("appSrc", `${APP}/add`);
    await sleep(1200);
    await film("thumbAway");
    await film("layer", "appwrap");
    await film("caption", "03", "Add it to DuaVault", "Text is read on your phone. Nothing is uploaded.");
    await sleep(1400);
    const choose = app.getByRole("button", { name: /Choose images/ });
    await tap(choose);
    await app.getByTestId("file-input").setInputFiles({ name: "IMG_2041.PNG", mimeType: "image/png", buffer: screenshot });
    await sleep(500);
    await appScrollTo(app.getByRole("img", { name: /Preview of/ }), 80, 600);
    const editor = app.getByTestId("draft-editor").first();
    await editor.waitFor({ timeout: 120_000 });
    await sleep(900);

    // 04 — review
    await film("caption", "04", "Checked against the Quran", "Matched to Surah Taha 20:25–28 and filed under Duas — with a morning reminder.");
    await appScrollTo(app.getByTestId("verification-panel").first(), 140, 1300);
    const useWording = app.getByRole("button", { name: /Use dataset wording/ });
    if (await useWording.count()) {
      await tap(useWording);
      await sleep(1500);
    }
    await sleep(2200);
    await appScrollTo(app.getByTestId("reminder-control").first(), 300, 1300);
    await sleep(2000);
    const title = app.getByLabel("Title").first();
    await appScrollTo(title, 160, 1000);
    await tap(title);
    await title.fill("");
    await title.pressSequentially(TITLE, { delay: 45 });
    await sleep(700);
    await appScrollTo(app.getByRole("button", { name: /Save to library/ }).first(), 420, 1000);
    await tap(app.getByRole("button", { name: /Save to library/ }).first());
    await sleep(1600);

    // 05 — tour
    await film("caption", "05", "It comes back to you", "A daily dua from your own library — not an endless feed.");
    await tap(app.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }));
    await sleep(2600);
    await appScroll(360, 1600);
    await appScroll(0, 800);
    await film("caption", "05", "Everything in one place", "Duas, adhkar, verses, hadith and reminders — searchable in Arabic or English.");
    await tap(app.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Library" }));
    await sleep(1800);
    await tap(app.getByTestId("library-grid").getByRole("link").first());
    await sleep(2200);
    await appScroll(420, 1600);
    await appScroll(0, 700);
    await film("caption", "05", "Memorize it", "Flashcards with spaced repetition. No streaks, no guilt.");
    await tap(app.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Practice" }));
    await sleep(1400);
    await tap(app.getByRole("link", { name: /Start review|Open flashcards/ }));
    await sleep(1300);
    await tap(app.getByRole("button", { name: /Reveal answer/ }));
    await sleep(1800);
    await tap(app.getByRole("button", { name: /Familiar/ }));
    await sleep(1500);
    await film("caption", "05", "Find what you need", "Describe how you feel — your own saved items come first.");
    await tap(app.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile" }));
    await sleep(900);
    await tap(app.getByRole("link", { name: "Find" }));
    await sleep(700);
    await app.getByRole("textbox", { name: "Describe what you need" }).pressSequentially("I'm feeling overwhelmed", { delay: 55 });
    await sleep(1600);
    await appScroll(260, 2400);

    // Train
    const itemId = await appFrame().evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open("duavault");
          req.onsuccess = () => {
            const all = req.result.transaction("items").objectStore("items").getAll();
            all.onsuccess = () => resolve(all.result.find((i) => i.reminderTime)?.id ?? all.result[0]?.id);
          };
        }),
    );
    await film("hideCaption");
    await film("phone", false);
    await film("train", true);
    await sleep(3600);
    await film("trainBuzz");
    await sleep(3000);
    await film("trainZoom");
    await sleep(1500);
    await film("layer", "lock");
    await film("setTime", "7:30");
    await film("train", false);
    await film("phone", true);
    await film("appSrc", `${APP}/items/${itemId}`);
    await film("caption", "06", "Tap, and it's right there", "Morning duas remind you in the morning. Evening adhkar in the evening.");
    await sleep(700);
    await film("notify", true);
    await sleep(2600);
    await film("touch", screenX + 195, screenY + 345, true);
    await sleep(700);
    await film("press", true);
    await sleep(160);
    await film("press", false);
    await film("hideTouch");
    await film("notify", false);
    await film("layer", "appwrap");
    await sleep(3200);
    await appScrollTo(app.getByTestId("reminder-control"), 260, 1400);
    await sleep(1800);

    // Outro
    await film("title", titleHtml("outro"));
    await sleep(1500);

    // The screencast only emits frames on change, so the settled final card may never arrive.
    // Add it explicitly, then hold it until the end of the outro.
    const still = await page.screenshot({ type: "jpeg", quality: 90 });
    const settledAt = Date.now() / 1000;
    frames.push({ t: settledAt, buf: still }, { t: settledAt + 3, buf: still });
    await cdp.send("Page.stopScreencast");
    console.log(`✓ captured ${frames.length} frames`);
    // Keep the raw frames so encoding can be re-run with --encode-only.
    await mkdir(FRAMES_DIR, { recursive: true });
    await Promise.all(frames.map((f, i) => writeFile(join(FRAMES_DIR, `${String(i).padStart(5, "0")}.jpg`), f.buf)));
    await writeFile(join(FRAMES_DIR, "index.json"), JSON.stringify(frames.map((f) => f.t)));
    await encode(frames, join(OUT, "duavault-demo.webm"));
  }
} catch (err) {
  const pages = context.pages();
  const last = pages[pages.length - 1];
  if (last) await last.screenshot({ path: join(OUT, "failure.png") }).catch(() => {});
  throw err;
} finally {
  await browser.close();
  server.close();
}

function titleHtml(kind) {
  const mark = `<svg class="mark" viewBox="0 0 512 512"><rect width="512" height="512" rx="130" fill="#2f5f48"/><path d="M256 120l41.6 94.4L392 256l-94.4 41.6L256 392l-41.6-94.4L120 256l94.4-41.6z" fill="#f6f2ea"/><circle cx="256" cy="256" r="34" fill="#c9a24e"/></svg>`;
  return kind === "intro"
    ? `${mark}<h1>DuaVault</h1><p class="tag">From a reel to remembrance.</p>`
    : `${mark}<h1>DuaVault</h1><p>Save it. Understand it. Remember it. Practise it.</p><p class="small">Free · on-device text recognition · no AI subscription</p>`;
}

function ffmpegPath() {
  const dir = join(homedir(), "Library/Caches/ms-playwright");
  if (existsSync(dir)) {
    const ff = readdirSync(dir).find((d) => d.startsWith("ffmpeg-"));
    if (ff) {
      const bin = join(dir, ff, process.platform === "darwin" ? "ffmpeg-mac" : "ffmpeg-linux");
      if (existsSync(bin)) return bin;
    }
  }
  return "ffmpeg";
}

/** Resamples the variable-rate screencast to a constant frame rate and encodes VP9. */
async function encode(frames, file) {
  if (!frames.length) throw new Error("No frames captured");
  frames.sort((a, b) => a.t - b.t);
  const start = frames[0].t;
  const end = frames[frames.length - 1].t;
  const ff = spawn(ffmpegPath(), [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-r", String(FPS), "-i", "pipe:0",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1",
    "-pix_fmt", "yuv420p", file,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  let idx = 0;
  const total = Math.ceil((end - start) * FPS);
  for (let n = 0; n <= total; n++) {
    const t = start + n / FPS;
    while (idx + 1 < frames.length && frames[idx + 1].t <= t) idx++;
    if (!ff.stdin.write(frames[idx].buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await done;
  console.log(`✓ ${file} (${(end - start).toFixed(1)}s @ ${FPS}fps)`);
}
