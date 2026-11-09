"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Search, SlidersHorizontal, X, LayoutGrid, List, ArrowUpRight, FolderHeart } from "lucide-react";
import type { ContentType, SavedItem } from "@/core/types";
import { TAXONOMY, getTypeDefinition } from "@/core/taxonomy";
import { topicLabel } from "@/core/classify/topics";
import { searchItems } from "@/core/search/search";
import { useItems, useProgress } from "@/lib/data/hooks";
import { EmptyState, PageHeader } from "@/components/common";
import { ItemCard, ItemCardSkeleton } from "@/components/items/item-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Filter = "all" | "favorites" | "memorized" | "unrevisited";
type Sort = "saved" | "practiced" | "title";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "favorites", label: "Favorites" },
  { id: "memorized", label: "Memorized" },
  { id: "unrevisited", label: "Never revisited" },
];

export function LibraryView({ type }: { type?: ContentType }) {
  const items = useItems();
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    return FILTERS.some((x) => x.id === f) ? (f as Filter) : "all";
  });
  const [sort, setSort] = useState<Sort>("saved");
  const [tag, setTag] = useState<string>("any");
  const [subcategory, setSubcategory] = useState<string>("any");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const progressById = useMemo(() => new Map((progress.data ?? []).map((p) => [p.itemId, p.state])), [progress.data]);
  const all = items.data ?? [];
  const scoped = type ? all.filter((i) => i.contentType === type) : all;
  const allTags = [...new Set(scoped.flatMap((i) => i.tags))].sort();

  const visible = useMemo(() => {
    let list: SavedItem[] = scoped;
    if (filter === "favorites") list = list.filter((i) => i.isFavorite);
    if (filter === "memorized") list = list.filter((i) => progressById.get(i.id) === "memorized");
    if (filter === "unrevisited") list = list.filter((i) => !i.lastReviewedAt);
    if (tag !== "any") list = list.filter((i) => i.tags.includes(tag));
    if (subcategory !== "any") list = list.filter((i) => i.subcategory === subcategory);
    if (query.trim()) {
      const hits = searchItems(list, query);
      return hits.map((h) => h.item);
    }
    const sorted = [...list];
    if (sort === "saved") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "practiced") sorted.sort((a, b) => (b.lastReviewedAt ?? "").localeCompare(a.lastReviewedAt ?? ""));
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [scoped, filter, tag, subcategory, query, sort, progressById]);

  const def = type ? getTypeDefinition(type) : null;
  const counts = new Map(TAXONOMY.map((t) => [t.type, all.filter((i) => i.contentType === t.type).length]));
  const anyFilter = filter !== "all" || tag !== "any" || subcategory !== "any" || query.trim();

  return (
    <div>
      <PageHeader
        eyebrow="Saved duas and reminders"
        title={def ? def.label : "Library"}
        description={def ? def.description : "Your saved duas, adhkar, Quran verses and Islamic reminders."}
        actions={
          <Button asChild>
            <Link href="/add">Add</Link>
          </Button>
        }
      />

      <div className="grid items-start gap-7 lg:grid-cols-[13rem_1fr] xl:gap-10">
      <aside className="min-w-0 lg:sticky lg:top-6">
      <p className="eyebrow mb-4 hidden lg:block">Browse categories</p>
      <nav aria-label="Categories" className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex-col lg:overflow-visible">
        {[{ href: "/library", label: "All", count: all.length, active: !type }, ...TAXONOMY.map((t) => ({ href: `/library/${t.type}`, label: t.label, count: counts.get(t.type) ?? 0, active: type === t.type }))].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center justify-between gap-4 rounded-xl border px-4 text-sm whitespace-nowrap transition-colors lg:w-full",
              tab.active ? "border-primary/30 bg-secondary font-medium text-secondary-foreground" : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
            )}
          >
            {tab.label} <span className="text-xs text-muted-foreground tabular-nums">{tab.count}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-6 hidden border-t pt-6 lg:block"><Link href="/collections" className="flex min-h-11 items-center gap-2 text-sm text-primary"><FolderHeart aria-hidden="true" className="size-4" />Your collections <ArrowUpRight aria-hidden="true" className="ml-auto size-4" /></Link><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Organize duas for your family, daily adhkar or study.</p></div>
      </aside>
      <section className="min-w-0" aria-label="Library items">

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in Arabic or English…"
            className="h-14 bg-card pl-10 text-base"
            dir="auto"
            aria-label="Search your library"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "min-h-11 rounded-full px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                filter === f.id ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            {def && (
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger size="sm" className="w-40" aria-label="Subcategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All subcategories</SelectItem>
                  {def.subcategories.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {allTags.length > 0 && (
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger size="sm" className="w-36" aria-label="Topic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any topic</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {topicLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)} disabled={!!query.trim()}>
              <SelectTrigger size="sm" className="w-44" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saved">Recently saved</SelectItem>
                <SelectItem value="practiced">Recently practiced</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground" role="status">{items.loading ? "Opening your library…" : `${visible.length} ${visible.length === 1 ? "item" : "items"}${anyFilter ? " found" : " to return to"}`}</p>
        <div className="flex gap-1 rounded-xl border p-1" role="group" aria-label="Library layout">
          <Button variant={layout === "grid" ? "secondary" : "ghost"} size="icon" className="size-10" onClick={() => setLayout("grid")} aria-label="Grid view" aria-pressed={layout === "grid"}><LayoutGrid aria-hidden="true" /></Button>
          <Button variant={layout === "list" ? "secondary" : "ghost"} size="icon" className="size-10" onClick={() => setLayout("list")} aria-label="List view" aria-pressed={layout === "list"}><List aria-hidden="true" /></Button>
        </div>
      </div>

      {items.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : items.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">Couldn&apos;t load your library: {items.error.message}</p>
      ) : visible.length ? (
        <div className={layout === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "divide-y rounded-2xl border bg-card px-5"} data-testid="library-grid">
          {visible.map((item) => (
            layout === "grid" ? <ItemCard key={item.id} item={item} memorization={progressById.get(item.id)} /> : <Link key={item.id} href={`/items/${item.id}`} className="group flex items-center gap-4 py-5"><span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground sm:flex"><BookOpen aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1"><span className="mb-1 block text-xs text-muted-foreground">{getTypeDefinition(item.contentType).singular}</span><span className="block truncate font-display text-xl group-hover:text-primary">{item.title}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{item.englishText || "Open to read"}</span></span><ArrowUpRight aria-hidden="true" className="size-5 shrink-0 text-primary" /></Link>
          ))}
        </div>
      ) : anyFilter ? (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          description="Try a different word, or clear the filters."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setTag("any");
                setSubcategory("any");
              }}
            >
              <X /> Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={BookOpen}
          title={def ? `No ${def.label.toLowerCase()} yet` : "Nothing saved yet"}
          description="Saved screenshots are sorted into categories here. You can change the category at any time."
          action={
            <Button asChild>
              <Link href="/add">Save a screenshot</Link>
            </Button>
          }
        />
      )}
      </section>
      </div>
    </div>
  );
}
