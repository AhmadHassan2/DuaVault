/**
 * Downloads the Quran text from Tanzil (https://tanzil.net) and writes the
 * reference dataset DuaVault uses for verification.
 *
 *   pnpm fetch:quran                     # Uthmani display + simple-clean matching + en.sahih
 *   pnpm fetch:quran --translation=none  # Arabic only
 *   pnpm fetch:quran --fixture           # also refresh the small test fixture
 *
 * Text is stored verbatim — Tanzil's terms do not allow modifying it.
 * Output (gitignored): public/data/quran/quran.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { QuranDataset } from "../src/core/verify/quran-matcher";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "public/data/quran/quran.json");
const FIXTURE = join(ROOT, "tests/fixtures/quran-subset.json");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);
const translationId = args.get("translation") ?? "en.sahih";

const TEXT_URL = (type: string) => `https://tanzil.net/pub/download/index.php?quranType=${type}&outType=txt-2&agree=true`;
const TRANS_URL = (id: string) => `https://tanzil.net/trans/?transID=${id}&type=txt-2`;
const META_URL = "https://tanzil.net/res/text/metadata/quran-data.js";

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  return res.text();
}

function parsePipe(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line.trimEnd());
    if (m) out.set(`${m[1]}:${m[2]}`, m[3]);
  }
  return out;
}

function headerName(text: string): string | null {
  return /#\s*Name:\s*(.+)/.exec(text)?.[1]?.trim() ?? null;
}

function parseSurahNames(meta: string): string[] {
  const names: string[] = [];
  const re = /\[\d+,\s*\d+,\s*\d+,\s*\d+,\s*'[^']*',\s*"([^"]+)"/g;
  for (const m of meta.matchAll(re)) names.push(m[1]);
  return names;
}

async function main() {
  console.log("Downloading Quran text from tanzil.net …");
  const [uthmani, clean, meta] = await Promise.all([download(TEXT_URL("uthmani")), download(TEXT_URL("simple-clean")), download(META_URL)]);
  const translation = translationId === "none" ? null : await download(TRANS_URL(translationId));

  const display = parsePipe(uthmani);
  const matching = parsePipe(clean);
  const trans = translation ? parsePipe(translation) : null;
  const surahNames = parseSurahNames(meta);

  if (display.size !== 6236 || matching.size !== 6236) {
    throw new Error(`Unexpected verse count (uthmani ${display.size}, clean ${matching.size}) — aborting.`);
  }
  if (surahNames.length !== 114) throw new Error(`Unexpected surah name count ${surahNames.length}`);

  const verses: QuranDataset["verses"] = [];
  for (const [key, text] of display) {
    const [s, a] = key.split(":").map(Number);
    verses.push({ surah: s, ayah: a, text, matchText: matching.get(key), translation: trans?.get(key) });
  }

  const translationName = translation ? headerName(translation) ?? translationId : undefined;
  const dataset: QuranDataset & { attribution: string; fetchedAt: string } = {
    sourceName: "Tanzil Quran Text",
    translationName,
    licence:
      "Quran text: Tanzil Project, CC BY 3.0 — verbatim copies only, changes not allowed (https://tanzil.net). " +
      (translation ? `Translation: ${translationName} via tanzil.net — check its terms before commercial use.` : ""),
    attribution: "Quran text from Tanzil Project — https://tanzil.net",
    fetchedAt: new Date().toISOString(),
    surahNames,
    verses,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(dataset));
  console.log(`Wrote ${verses.length} verses → ${OUT}`);

  if (args.has("fixture")) {
    const keep = (s: number, a: number) =>
      s === 1 || (s === 2 && a >= 250) || (s === 3 && a <= 10) || (s === 20 && a >= 24 && a <= 28) || (s === 20 && a === 114) || s === 94 || s >= 112;
    const subset = { ...dataset, verses: verses.filter((v) => keep(v.surah, v.ayah)) };
    await mkdir(dirname(FIXTURE), { recursive: true });
    await writeFile(FIXTURE, JSON.stringify(subset, null, 1));
    console.log(`Wrote ${subset.verses.length}-verse test fixture → ${FIXTURE}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
