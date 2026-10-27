/**
 * Imports a vetted hadith / dua / dhikr dataset for verification.
 *
 *   pnpm import:references path/to/dataset.json [--supabase]
 *
 * Dataset format (JSON):
 * {
 *   "source": { "id": "hisn-example", "name": "…", "kind": "dua", "licence": "…", "url": "https://…" },
 *   "entries": [
 *     { "id": "1", "arabic": "…", "translation": "…", "transliteration": "…",
 *       "referenceLabel": "…", "grade": "…", "gradeSource": "…", "topics": ["forgiveness"] }
 *   ]
 * }
 *
 * Rules enforced here:
 * - every source must declare a licence and URL (provenance);
 * - a grade is only accepted together with who graded it;
 * - text is stored exactly as provided.
 *
 * Output: public/data/references/<source-id>.json + manifest.json (local mode),
 * and optionally rows in Supabase (requires SUPABASE_SERVICE_ROLE_KEY — server-side only).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { normalizeArabic } from "../src/core/text/arabic";
import type { ReferenceEntry, ReferenceSourceInfo } from "../src/core/types";

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public/data/references");

const Source = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/, "source.id must be lowercase letters, digits and dashes"),
  name: z.string().min(2),
  kind: z.enum(["hadith", "dua", "dhikr"]),
  licence: z.string().min(2, "A licence is required so provenance is clear"),
  url: z.url(),
});

const Entry = z
  .object({
    id: z.string().min(1),
    arabic: z.string().min(2),
    translation: z.string().optional(),
    transliteration: z.string().optional(),
    referenceLabel: z.string().min(1),
    grade: z.string().optional(),
    gradeSource: z.string().optional(),
    topics: z.array(z.string()).optional(),
  })
  .refine((e) => !e.grade || !!e.gradeSource, { message: "grade requires gradeSource (who graded it)" });

const Dataset = z.object({ source: Source, entries: z.array(Entry).min(1) });

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Usage: pnpm import:references <dataset.json> [--supabase]");
    process.exit(1);
  }
  const parsed = Dataset.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) {
    console.error("Dataset is invalid:\n" + z.prettifyError(parsed.error));
    process.exit(1);
  }
  const { source, entries } = parsed.data;
  const refs: ReferenceEntry[] = entries.map((e) => ({
    id: `${source.id}:${e.id}`,
    sourceId: source.id,
    sourceName: source.name,
    kind: source.kind,
    arabic: e.arabic,
    translation: e.translation,
    transliteration: e.transliteration,
    referenceLabel: e.referenceLabel,
    grade: e.grade,
    gradeSource: e.gradeSource,
    topics: e.topics,
  }));

  await mkdir(OUT_DIR, { recursive: true });
  const fileName = `${source.id}.json`;
  await writeFile(join(OUT_DIR, fileName), JSON.stringify(refs));

  const manifestPath = join(OUT_DIR, "manifest.json");
  let manifest: { sources: Array<ReferenceSourceInfo & { file: string }> } = { sources: [] };
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    // first import
  }
  const info = {
    id: source.id,
    name: source.name,
    kind: source.kind,
    licence: source.licence,
    url: source.url,
    entryCount: refs.length,
    importedAt: new Date().toISOString(),
    file: fileName,
  };
  manifest.sources = [...manifest.sources.filter((s) => s.id !== source.id), info];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Imported ${refs.length} entries from "${source.name}" → ${join(OUT_DIR, fileName)}`);

  if (process.argv.includes("--supabase")) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("--supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error: sErr } = await db.from("reference_sources").upsert({
      id: source.id,
      name: source.name,
      kind: source.kind,
      licence: source.licence,
      url: source.url,
    });
    if (sErr) throw sErr;
    for (let i = 0; i < refs.length; i += 500) {
      const { error } = await db.from("verified_reference_entries").upsert(
        refs.slice(i, i + 500).map((r) => ({
          id: r.id,
          source_id: r.sourceId,
          kind: r.kind,
          arabic: r.arabic,
          arabic_normalized: normalizeArabic(r.arabic),
          translation: r.translation ?? null,
          transliteration: r.transliteration ?? null,
          reference_label: r.referenceLabel,
          grade: r.grade ?? null,
          grade_source: r.gradeSource ?? null,
          topics: r.topics ?? [],
        })),
      );
      if (error) throw error;
    }
    console.log("Also upserted into Supabase.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
