"use client";

import { useState } from "react";
import { Bookmark, BookOpen, Check, Leaf, RotateCcw, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Quranic supplications; excerpts are identified in the source label.
const DUAS = [
  {
    title: "For knowledge",
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    translation: "My Lord, increase me in knowledge.",
    reference: "20:114",
    excerpt: true,
  },
  {
    title: "For forgiveness",
    arabic: "لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    translation: "There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.",
    reference: "21:87",
    excerpt: true,
  },
  {
    title: "For family",
    arabic: "رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ",
    translation: "Our Lord, forgive me and my parents and the believers the Day the account is established.",
    reference: "14:41",
    excerpt: false,
  },
];

export function ReadingPreview() {
  const [mode, setMode] = useState<"read" | "memorize">("read");
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const [savedDuas, setSavedDuas] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  const dua = DUAS[index];
  const saved = savedDuas.includes(dua.reference);

  function selectDua(next: number) {
    setIndex((next + DUAS.length) % DUAS.length);
    setRevealed(false);
    setCopyStatus("");
  }

  async function copyDua() {
    try {
      await navigator.clipboard.writeText(`${dua.arabic}\n\n${dua.translation}\nQuran ${dua.reference}${dua.excerpt ? " (excerpt)" : ""} · Saheeh International`);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Couldn’t copy. Please try again.");
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div aria-hidden="true" className="absolute -inset-3 bottom-6 rounded-[2.5rem] border border-primary/10" />
      <section aria-label="Interactive library preview" className="reading-preview relative rounded-[2rem] border border-primary/25 bg-card p-5 text-foreground shadow-2xl shadow-background/30 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base text-foreground"><Leaf aria-hidden="true" className="size-5 shrink-0 text-primary" /> Dua and remembrance</span>
          <span className="rounded-full bg-gold-soft px-3 py-1 text-sm font-medium text-accent-foreground">Preview</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-full bg-muted p-1.5" role="group" aria-label="Preview mode">
          {(["read", "memorize"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setRevealed(false); }} className={cn("min-h-12 cursor-pointer rounded-full px-2 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", mode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {value === "read" ? "Read & understand" : "Try a flashcard"}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-5 py-8 text-center" aria-live="polite">
          <span className="rounded-full bg-gold-soft px-4 py-1.5 text-sm leading-5 font-semibold tracking-[0.08em] text-accent-foreground uppercase">{dua.title}</span>
          <div className="flex min-h-28 w-full items-center justify-center">
          <p lang="ar" dir="rtl" className="arabic w-full px-1 text-4xl text-forest sm:text-[2.75rem]">{dua.arabic}</p>
          </div>
          <div className="flex min-h-28 w-full items-center justify-center">
          {mode === "read" || revealed ? (
            <p className="max-w-sm font-display text-2xl leading-snug text-balance sm:text-[1.625rem]">“{dua.translation}”</p>
          ) : (
            <Button variant="outline" className="min-h-12 rounded-full px-5 text-base" onClick={() => setRevealed(true)}>Reveal translation <BookOpen aria-hidden="true" /></Button>
          )}
          </div>
        </div>
        <div className="mb-5 flex items-center justify-between gap-2" role="group" aria-label="Browse duas">
          <Button variant="outline" size="icon" className="size-12 rounded-full bg-card text-primary" aria-label="Previous dua" onClick={() => selectDua(index - 1)}><ChevronLeft aria-hidden="true" className="size-5" /></Button>
          <div className="flex items-center gap-1">
            {DUAS.map((item, i) => <button key={item.reference} type="button" aria-label={item.title} aria-pressed={i === index} onClick={() => selectDua(i)} className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"><span aria-hidden="true" className={cn("h-2 rounded-full transition-all motion-reduce:transition-none", i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40")} /></button>)}
          </div>
          <Button variant="outline" size="icon" className="size-12 rounded-full bg-card text-primary" aria-label="Next dua" onClick={() => selectDua(index + 1)}><ChevronRight aria-hidden="true" className="size-5" /></Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <a href={`https://quran.com/${dua.reference.replace(":", "/")}?translations=20`} target="_blank" rel="noopener noreferrer" className="rounded text-base font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Quran {dua.reference}{dua.excerpt ? " · excerpt" : ""}<span className="mt-1 block text-sm font-normal text-muted-foreground">Saheeh International ↗</span></a>
            <button type="button" aria-pressed={saved} onClick={() => setSavedDuas((previous) => saved ? previous.filter((ref) => ref !== dua.reference) : [...previous, dua.reference])} className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-sage-soft px-4 text-base font-medium text-forest transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {saved ? <Check aria-hidden="true" className="size-4" /> : <Bookmark aria-hidden="true" className="size-4" />}{saved ? "Saved in preview" : "Try saving"}
            </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="min-h-12 rounded-full px-3 text-base text-muted-foreground" onClick={copyDua}><Copy aria-hidden="true" /> Copy dua</Button>
          {mode === "memorize" && <Button variant="ghost" className="min-h-12 rounded-full text-base" onClick={() => setRevealed(false)} disabled={!revealed}><RotateCcw aria-hidden="true" /> Try again</Button>}
          <span role="status" className="text-sm text-muted-foreground">{copyStatus}</span>
        </div>
      </section>
      <p className="mt-5 text-center text-sm text-muted-foreground">Browse, save or practice. Saves stay in this preview.</p>
    </div>
  );
}
