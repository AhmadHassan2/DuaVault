import Link from "next/link";
import { ArrowRight, ArrowDown, BookOpen, ScanLine, ShieldCheck, Sprout, LockKeyhole, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/logo";
import { config } from "@/lib/config";
import { ReadingPreview } from "@/components/landing/reading-preview";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HorseFilm } from "@/components/landing/horse-film";

export default function LandingPage() {
  const startHref = config.dataMode === "supabase" ? "/auth" : "/home";
  return (
    <div className="landing-page min-h-dvh">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Wordmark className="[&_svg]:size-9 [&>span]:text-2xl" />
        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
          <a href="#your-daily-pause" className="hidden min-h-11 items-center text-sm text-muted-foreground hover:text-primary sm:inline-flex">Explore the duas</a>
          <ThemeToggle />
          <Button asChild variant="outline" className="rounded-full"><Link href={startHref}>{config.dataMode === "supabase" ? "Sign in" : "Open app"}<ArrowRight aria-hidden="true" /></Link></Button>
        </nav>
      </header>
      <main>
        <section className="relative isolate mx-auto max-w-6xl px-5 pt-10 pb-12 text-center sm:px-8 sm:pt-12">
          <p className="eyebrow inline-flex items-center gap-3"><span className="h-px w-7 bg-primary/50" />Dua, dhikr and remembrance of Allah<span className="h-px w-7 bg-primary/50" /></p>
          <h1 className="mx-auto mt-6 max-w-5xl text-5xl leading-[1.03] font-medium tracking-[-0.035em] text-balance sm:text-6xl lg:text-[5rem]">Remember Allah.<br /><span className="text-primary italic">Make dua part of your day.</span></h1>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">Keep your duas, adhkar and Islamic reminders in one place.<br className="hidden sm:block" /> Read, memorize and practice.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href={startHref}>Start your library <ArrowRight aria-hidden="true" /></Link></Button>
            <Button asChild variant="ghost" size="lg"><a href="#your-daily-pause">Preview the app <ArrowDown aria-hidden="true" /></a></Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{config.dataMode === "local" ? "Free to begin. No account needed." : "Your personal library for dua and dhikr."}</p>
        </section>

        <section aria-label="A rider’s journey" className="mx-auto max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
          <HorseFilm src="/videos/horse-rider.mp4" poster="/videos/horse-rider-poster.webp" />
        </section>

        <section id="your-daily-pause" aria-label="Explore DuaVault" className="mx-auto max-w-7xl scroll-mt-6 px-5 pb-16 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.8fr_1fr] lg:gap-12">
            <div className="hidden space-y-12 lg:block">
              <div><span className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-secondary text-secondary-foreground"><BookOpen aria-hidden="true" className="size-5" /></span><p className="eyebrow">Read & understand</p><h2 className="mt-3 text-3xl leading-tight">Understand what<br />you recite.</h2><p className="mt-3 max-w-52 text-sm leading-relaxed text-muted-foreground">Read the Arabic and its meaning, with the source clearly identified.</p></div>
              <div className="border-l border-primary/30 pl-5"><p className="font-display text-2xl leading-snug text-primary italic">Remember Allah<br />throughout your day.</p></div>
            </div>
            <ReadingPreview />
            <div className="hidden space-y-9 lg:block">
              <div className="border-b pb-7"><Sprout aria-hidden="true" className="mb-4 size-6 text-forest" /><p className="eyebrow">Regular remembrance</p><h2 className="mt-3 text-2xl">Memorize your duas.</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Review the Arabic and translation with flashcards.</p></div>
              <div><NotebookPen aria-hidden="true" className="mb-4 size-6 text-secondary-foreground" /><h2 className="text-2xl">Record your own duas.</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Keep a private record of your supplications and reflections.</p></div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />{config.dataMode === "local" ? "Private to your device" : "Private to your account"}</p>
            </div>
          </div>
        </section>

        <section className="border-y bg-paper/70">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div><p className="eyebrow">Save, learn and practice</p><h2 className="mt-4 max-w-sm text-4xl leading-tight sm:text-5xl">Preserve beneficial reminders.<br /><span className="text-primary italic">Return to them regularly.</span></h2><Link href={startHref} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">Start with one screenshot <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
            <ol className="divide-y">
              {[
                { icon: ScanLine, title: "Save duas and Islamic reminders", body: "Add a screenshot or paste text. Review it before it enters your library." },
                { icon: ShieldCheck, title: "Review the text and its source", body: "See reference matches and clear labels when a source cannot be verified." },
                { icon: Sprout, title: "Build a regular practice", body: "Read daily, review with flashcards and record your personal duas." },
              ].map(({ icon: Icon, title, body }, i) => <li key={title} className="flex gap-4 py-6 first:pt-0 last:pb-0 sm:gap-6"><span className="mt-1 text-xs text-primary tabular-nums">0{i + 1}</span><div className="flex-1"><h3 className="text-2xl">{title}</h3><p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{body}</p></div><Icon aria-hidden="true" className="mt-1 hidden size-5 shrink-0 text-primary sm:block" /></li>)}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl items-center gap-6 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <p lang="ar" dir="rtl" className="arabic text-center text-3xl text-forest sm:text-4xl">أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ</p>
          <figure className="text-center lg:text-left"><blockquote className="font-display text-2xl leading-relaxed text-balance italic">“Unquestionably, by the remembrance of Allah hearts are assured.”</blockquote><figcaption className="mt-4 text-xs text-muted-foreground">Quran 13:28 · Arabic: Tanzil · Translation: Saheeh International</figcaption></figure>
        </section>
      </main>
      <footer className="border-t"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-8 sm:px-8"><Wordmark /><p className="max-w-lg text-xs leading-relaxed text-muted-foreground">DuaVault never invents references or translations and does not issue religious rulings. Always review what you save.</p><Link href={startHref} className="inline-flex min-h-11 items-center gap-2 text-sm text-primary">Open DuaVault <ArrowRight aria-hidden="true" className="size-4" /></Link></div></footer>
    </div>
  );
}
