"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookMarked, Compass, Info, Search } from "lucide-react";
import { TOPIC_BY_SLUG } from "@/core/classify/topics";
import { explainQuery, parseQuery, searchDocs, searchItems, type ParsedQuery, type SearchableDoc } from "@/core/search/search";
import { stem } from "@/core/text/english";
import type { QuranVerse } from "@/core/verify/quran-matcher";
import type { ReferenceEntry } from "@/core/types";
import { useItems, useProgress } from "@/lib/data/hooks";
import { getReferenceProvider } from "@/lib/references/static-provider";
import { ArabicText, PageHeader, SectionHeading } from "@/components/common";
import { ItemCard } from "@/components/items/item-card";
import { Input } from "@/components/ui/input";

const EXAMPLES = [
  "Duas for forgiveness",
  "I'm feeling overwhelmed",
  "Dua before studying",
  "Reminders about patience",
  "Something about trusting Allah",
  "For my parents",
];

interface DatasetDocs {
  quran: Array<{ doc: SearchableDoc; item: QuranVerse & { label: string } }>;
  refs: Array<{ doc: SearchableDoc; item: ReferenceEntry }>;
}

export function FindView() {
  const items = useItems();
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<DatasetDocs | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const provider = getReferenceProvider();
      const [q, r] = await Promise.all([provider.getQuranMatcher(), provider.getReferenceMatcher()]);
      if (cancelled) return;
      setDatasets({
        quran: (q?.dataset.verses ?? [])
          .filter((v) => v.translation)
          .map((v) => ({
            item: { ...v, label: q!.label(v.surah, v.ayah) },
            doc: { id: `${v.surah}:${v.ayah}`, title: "", english: v.translation!, arabic: "", tags: [], contentType: "quran", subcategory: "verses" },
          })),
        refs: (r?.entries ?? []).map((e) => ({
          item: e,
          doc: {
            id: e.id,
            title: e.referenceLabel,
            english: e.translation ?? "",
            arabic: e.arabic,
            tags: e.topics ?? [],
            contentType: e.kind === "dhikr" ? "adhkar" : e.kind === "quran" ? "quran" : e.kind,
            subcategory: "other",
          },
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Deferred so typing stays responsive while the dataset search catches up.
  const deferred = useDeferredValue(query);
  const parsed = useMemo(() => (deferred.trim() ? parseQuery(deferred) : null), [deferred]);
  const saved = useMemo(() => (deferred.trim() ? searchItems(items.data ?? [], deferred) : []), [items.data, deferred]);

  // For dataset search, expand situations ("overwhelmed") into topic keywords ("distress", "patience").
  const expanded: ParsedQuery | null = useMemo(() => {
    if (!parsed) return null;
    const extra = parsed.topics.flatMap((t) => TOPIC_BY_SLUG.get(t.slug)?.en.filter((w) => !w.includes(" ")).slice(0, 4) ?? []).map(stem);
    return { ...parsed, contentType: null, topics: [], terms: [...new Set([...parsed.terms, ...extra])] };
  }, [parsed]);
  const verses = useMemo(
    () => (expanded && datasets?.quran.length && expanded.terms.length ? searchDocs(datasets.quran, expanded).slice(0, 5) : []),
    [expanded, datasets],
  );
  const refs = useMemo(() => (parsed && datasets?.refs.length ? searchDocs(datasets.refs, parsed).slice(0, 5) : []), [parsed, datasets]);

  const progressById = new Map((progress.data ?? []).map((p) => [p.itemId, p.state]));
  const explanation = parsed ? explainQuery(parsed) : null;

  return (
    <div>
      <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Search duas and reminders"
        title="Find what you need"
        description="Search by topic, need or occasion. Your saved items appear first."
        className="justify-center text-center"
      />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. “I'm feeling anxious about exams”"
          className="h-16 rounded-2xl pl-12 text-lg shadow-sm"
          aria-label="Describe what you need"
          dir="auto"
          autoFocus
        />
      </div>
      {parsed && <div className="mb-8 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => setQuery(e)} className="min-h-11 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            {e}
          </button>
        ))}
      </div>}
      </div>

      {!parsed ? (
        <section className="mx-auto mt-10 max-w-4xl"><p className="eyebrow mb-5 text-center">Browse common topics</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{EXAMPLES.map((example,i)=><button type="button" key={example} onClick={()=>setQuery(example)} className="paper-card interactive-card flex min-h-36 flex-col items-start justify-between gap-6 p-6 text-left"><Compass aria-hidden="true" className={`size-5 ${i%2===0?"text-primary":"text-forest"}`} /><span className="flex w-full items-center justify-between gap-3"><span className="font-display text-xl">{example}</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></span></button>)}</div><p className="mx-auto mt-7 max-w-md text-center text-xs leading-relaxed text-muted-foreground">Explore your saved words and reference translations through topic matching. Read results in context; they are not religious rulings.</p></section>
      ) : (
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
          {explanation && <p className="text-sm text-muted-foreground lg:col-span-2">{explanation}</p>}

          <section>
            <SectionHeading title="From your vault" />
            {saved.length ? (
              <div className="grid gap-4 sm:grid-cols-2" data-testid="find-results">
                {saved.slice(0, 12).map((h) => (
                  <ItemCard key={h.item.id} item={h.item} memorization={progressById.get(h.item.id)} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
                Nothing in your vault matches yet.{" "}
                <Link href="/add" className="text-primary hover:underline">
                  Save a reminder
                </Link>{" "}
                — next time it&apos;ll be here.
              </p>
            )}
          </section>

          <aside className="min-w-0 space-y-8">
          {refs.length > 0 && (
            <section>
              <SectionHeading title="From imported references" />
              <ul className="space-y-3">
                {refs.map(({ item: e }) => (
                  <li key={e.id} className="paper-card p-4">
                    <ArabicText size="md">{e.arabic}</ArabicText>
                    {e.translation && <p className="mt-2 text-sm">{e.translation}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {e.referenceLabel} · {e.sourceName}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {verses.length > 0 && (
            <section>
              <SectionHeading title="Verses that mention this" />
              <p className="mb-3 flex gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Keyword matches in the translation of the loaded Quran dataset — read them in context; this is not a recommendation or ruling.
              </p>
              <ul className="space-y-3">
                {verses.map(({ item: v }) => (
                  <li key={`${v.surah}:${v.ayah}`} className="paper-card p-4">
                    <ArabicText size="md">{v.text}</ArabicText>
                    <p className="mt-2 text-sm leading-relaxed">{v.translation}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BookMarked className="size-3.5" /> {v.label}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!refs.length && !verses.length && <div className="rounded-2xl border p-6"><BookMarked aria-hidden="true" className="mb-4 size-6 text-primary" /><h2 className="text-2xl">A place for trusted words</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Matches from your loaded reference datasets will appear here, alongside your own saved items.</p></div>}
          </aside>
        </div>
      )}
    </div>
  );
}
