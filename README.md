# DuaVault

A calm, mobile-first library for the Islamic content you screenshot — duas, adhkar, verses, hadith and reminders — so you actually come back to it.

**Save it → Understand it → Remember it → Practice it.**

- Screenshots are read **on your device** with Tesseract.js (Arabic + English). No paid AI, no API key, no cloud LLM.
- Content is classified by **transparent, rule-based** logic you can always correct before saving.
- Arabic is checked against a **trusted Quran dataset** (Tanzil) and any **vetted hadith/dua datasets you import**. Nothing is marked verified without a dataset match, and DuaVault never invents references, grades, translations or transliterations.
- **Time-of-day reminders:** a morning dua reminds you in the morning, evening adhkar in the evening, before-sleep duas at night — on Home, as a notification while the app is open, and via “Add to calendar” for reliable phone alerts.
- A **daily dua** from your own vault, **spaced-repetition memorization**, collections, situational search (“I'm feeling overwhelmed”), and a private dua journal.
- Works fully offline-first in **on-device mode** (IndexedDB) or with **Supabase** (auth, Postgres + RLS, private storage).

---

## Quick start (on-device mode — no accounts)

```bash
pnpm install
pnpm fetch:quran      # one-time: downloads the Tanzil Quran text + translation into public/data (gitignored)
pnpm dev              # http://localhost:3000
```

Skipping `fetch:quran` is fine — the app works, but Quran verification is disabled and items show as unverified.

The first OCR run downloads the Tesseract engine and Arabic/English language data (a few MB) from jsDelivr. Your images never leave the browser.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js dev server / production build / serve |
| `pnpm test` | Vitest unit tests for the core logic |
| `pnpm e2e` | Playwright end-to-end tests (desktop + mobile; one real-OCR test) |
| `pnpm test:db` | Applies the Supabase migrations to a throwaway local Postgres and runs an RLS smoke test (no Docker) |
| `pnpm lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `pnpm fetch:quran [--translation=en.sahih\|none] [--fixture]` | Download Quran dataset (and refresh the test fixture) |
| `pnpm import:references <file.json> [--supabase]` | Import a vetted hadith/dua/dhikr dataset |
| `pnpm generate:categories` | Regenerate the categories migration from `src/core/taxonomy.ts` |

## Demo video

`demo/` contains a scripted demo film: reels feed → screenshot → saving it in DuaVault → app tour → a morning reminder on a train.

```bash
pnpm build && pnpm start -p 3100                         # production build (no dev overlay)
DEMO_APP_URL=http://localhost:3100 pnpm demo:record      # → demo/out/duavault-demo.webm (~100 s, 1080p)
pnpm demo:record --stills                                 # quick key-frame preview
node demo/record.mjs --encode-only                        # re-encode saved frames
pnpm demo:mp4                                             # → demo/out/duavault-demo.mp4 (H.264, plays in QuickTime/VS Code)
```

The reels feed and the train carriage are illustrations (the feed is deliberately unbranded). Everything shown inside the phone during the save and tour is the real app — real OCR, verification and storage. The dua (Quran 20:25–28) is taken verbatim from the Tanzil dataset. The WebM is encoded with the ffmpeg build bundled with Playwright; the MP4 uses the H.264 encoder in your installed Google Chrome (WebCodecs). No extra installs needed.

## Architecture

```
src/
  core/        Pure TypeScript domain logic — no React, Next or DOM (reusable by a future Expo app)
    types.ts, taxonomy.ts           domain model + category tree
    text/                           Arabic/English normalization (matching keys only), OCR cleanup, segmentation
    classify/                       ClassifierStrategy interface, RuleBasedClassifier, CompositeClassifier, topic lexicon
    verify/                         reference parser, shingle index, QuranMatcher, ReferenceEntryMatcher, verifyContent
    dedupe/, schedule/, search/     duplicate detection, SM-2-style SRS + daily pick, situational search
    pipeline/                       OCR → clean → segment → verify → classify → dedupe → drafts
    data/repository.ts              Repository interface (storage-agnostic)
  lib/
    ocr/                            TesseractOcrEngine (two-pass) + canvas preprocessing
    data/                           IndexedDbRepository, SupabaseRepository, live-query hooks
    references/                     loads datasets from /public/data lazily
    supabase/                       browser/server clients
  components/                       UI (shadcn/ui customised), views/ = one client view per screen
  app/                              routes; each page is a thin server file rendering a client view
  proxy.ts                          Supabase session refresh + auth redirect (supabase mode only)
supabase/migrations                 schema, RLS, storage policies, FTS function, categories
scripts/                            fetch-quran, import-references, generate-categories, test-db.sh
tests/unit, tests/e2e               Vitest, Playwright
```

Each engine is behind an interface and independently replaceable:

| Concern | Interface | Shipped implementation |
| --- | --- | --- |
| OCR | `OcrEngine` | `TesseractOcrEngine` |
| Classification | `ClassifierStrategy` | `RuleBasedClassifier` inside `CompositeClassifier` (add a local model as another strategy) |
| Optional off-device model | `ExternalClassifierAdapter` | **none** — contract only; must be opt-in and show what is sent |
| References | `ReferenceProvider` | `StaticJsonReferenceProvider` |
| Storage | `Repository` | `IndexedDbRepository`, `SupabaseRepository` |

### How OCR works

1. The image is decoded locally, upscaled if small, converted to grayscale, contrast-stretched, and inverted if it's a dark-mode screenshot.
2. **Pass 1** (`ara+eng`) finds the layout and reads Latin text.
3. **Pass 2** re-reads every line containing Arabic with the **Arabic-only** model (overlapping line boxes are merged first). The combined model often turns Arabic glyphs into Latin junk; the focused pass is much cleaner. The better reading per line is kept.
4. Cleaning only touches whitespace, zero-width characters and whole lines of app chrome (“1,204 likes”, clocks, usernames). Words are never “corrected”. Removed lines are shown to the user, and the raw OCR text is stored with the item.
5. Lines with low confidence are listed in the review screen; low page confidence triggers a warning.

### How classification works

`RuleBasedClassifier` scores each content type with weighted signals: dataset matches (Quran/imported refs), claimed references (`Quran 2:286`, `Sahih Muslim`), Arabic openers (`اللهم`, `ربنا`, `أصبحنا`), narration phrasing (“Narrated…”, `قال رسول الله`), repetition counts, reminder/lesson vocabulary, etc. Confidence combines signal strength and the lead over the runner-up, and the reasons are shown on hover. A topic lexicon (EN + AR keywords) produces tags and subcategories. Quranic supplications (e.g. those starting with ربنا) are filed as duas while keeping their Quran verification. Hadith “Verified/Unverified” is **derived from dataset verification**, never chosen freely.

### How verification works

- Text is normalized (diacritics removed, alef/ya/ta-marbuta folded) **only to build comparison keys**.
- A word-shingle index finds candidate verses and grows multi-verse spans. Results are `exact`, `partial` (verbatim part of a verse) or `possible` (similar, e.g. OCR errors). Uthmani and plain spellings are both compared.
- Statuses: **Verified reference match** · **Possible match — compare** · **Source given, not independently verified** · **Unverified** · **Review required** (e.g. the cited reference doesn't match the Arabic). Every result carries plain-language notes and the dataset name.
- When the text is close but not identical, the user can choose to adopt the dataset wording; it is never applied automatically.
- Similarity scores are explicitly **not** authenticity scores. Grades are only shown when an imported dataset supplies them, together with who graded them.

## Configuring Supabase

1. Create a project at supabase.com (free tier is fine).
2. Apply the migrations: `supabase link --project-ref <ref>` then `supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor, in order).
3. Auth → URL configuration: add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for dev) to redirect URLs.
4. Set in `.env.local`:
   ```
   NEXT_PUBLIC_DATA_MODE=supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. Optional: import vetted reference datasets into Postgres with `SUPABASE_SERVICE_ROLE_KEY=... pnpm import:references data.json --supabase`.

Local Supabase (`supabase start`) also works if you have Docker; `supabase/config.toml` is included.

### Database schema (summary)

`profiles` · `categories` (taxonomy, FK target) · `saved_items` (text, OCR raw text + confidence, claimed source, verification columns + notes, private screenshot path, favorite, practice count, `last_reviewed_at`, generated `search_tsv`) · `tags` + `saved_item_tags` · `collections` + `collection_items` · `practice_history` · `memorization_progress` (ease, interval, repetitions, due date) · `reminder_preferences` · `journal_entries` (separate, owner-only) · `reference_sources` + `verified_reference_entries` (read-only to users; grade requires grade source).

RLS is enabled on every table. User tables are owner-only for select/insert/update/delete. Join tables additionally require that both sides belong to the caller. The `screenshots` bucket is private, with paths `"<uid>/…"` enforced by storage policies, and images are shown through short-lived signed URLs. `record_practice` and `search_saved_items` run as `security invoker`, so RLS still applies.

## Importing reference datasets

```json
{
  "source": { "id": "my-dua-book", "name": "…", "kind": "dua", "licence": "…", "url": "https://…" },
  "entries": [
    { "id": "1", "arabic": "…", "translation": "…", "transliteration": "…", "referenceLabel": "…",
      "grade": "…", "gradeSource": "…", "topics": ["forgiveness"] }
  ]
}
```

The importer rejects sources without a licence/URL and grades without a grade source. No hadith or dua data ships with the app.

## Data sources & licences

- **Quran text:** [Tanzil Project](https://tanzil.net), CC BY 3.0 — verbatim copies only, changes not allowed. Downloaded by `pnpm fetch:quran`.
- **Translation:** Saheeh International via tanzil.net by default. Tanzil marks translations for non-commercial use; check the terms before commercial use, or run `pnpm fetch:quran --translation=none`.
- `tests/fixtures/quran-subset.json` is a verbatim Tanzil excerpt used by tests.

## What's tested

- **Unit (Vitest, 57 tests):** normalization never mutates originals, OCR cleanup, segmentation, reference parsing, Quran matching (exact, Uthmani, multi-verse, partial, OCR-damaged, no match), verification statuses and grade handling, classifier per category, SRS, daily pick determinism/weighting, duplicate detection, situational search, the full pipeline with an OCR test double, time-of-day reminder detection, due windows (incl. across midnight) and the .ics calendar export.
- **E2E (Playwright, desktop + Pixel 7):** typed text → verified → save → library → detail → favorite/practice → memorization → collection → flashcard review → daily card; mismatched-reference flagging + Find What You Need; morning reminder → Home "Morning adhkar time" card (frozen clock); journal privacy; navigation; **real Tesseract OCR** on a rendered screenshot through to the saved original image.
- **Database:** `pnpm test:db` applies both migrations to plain Postgres with stubbed `auth`/`storage` schemas and checks cross-user isolation (read, search, update, collection linking, storage upload, owner spoofing).

## Known limitations

- OCR quality depends heavily on the image. Stylised calligraphy, decorative fonts, text over photos and very small text are often misread. Cropping helps, and the user always reviews.
- The Supabase repository and auth flow are implemented, but were only tested against plain Postgres with stubbed auth/storage (`pnpm test:db`), not a live Supabase project.
- No hadith/dua datasets are bundled, so hadith can only be “source given, not verified” until you import one.
- Transliteration and audio appear only when a dataset provides them; none ships today.
- Reminders: morning/evening/before-sleep items get a daily reminder automatically. Delivered as a Home card + browser notification while DuaVault is open, and via a daily repeating calendar file (.ics) when closed. True background push needs a push server or native app (not built).
- The PWA share target works on Chromium/Android once installed; it is not supported on iOS Safari. Content behind private social-media accounts can't be fetched — save a screenshot instead.
- In on-device mode, clearing site data deletes the vault. Use Profile → Export.

## Next phases

- Better verification: bundled vetted Hisn al-Muslim/hadith datasets with clear licences; server-side matching via `verified_reference_entries` + pg_trgm.
- Optional on-device model (e.g. a small WASM classifier) as an extra `ClassifierStrategy`.
- Push notifications for daily reminders; home-screen widgets via a native app.
- Expo app reusing `src/core` (extract to a workspace package), with native share-sheet import.
- Offline sync between IndexedDB and Supabase; shared collections; folder import.
