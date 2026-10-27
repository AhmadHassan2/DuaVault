import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/logo";
import { config } from "@/lib/config";

const STEPS = [
  { title: "Save it", body: "Add the screenshot you took on Instagram, TikTok or YouTube. The text is read on your device." },
  { title: "Check it", body: "The Arabic is compared with trusted datasets. When a source can't be confirmed, DuaVault says so." },
  { title: "Find it", body: "Items are filed as duas, adhkar, verses, hadith or reminders, and can be searched by situation." },
  { title: "Practise it", body: "A daily dua from your own library, reminders at the right time of day, and flashcards for memorizing." },
];

export default function LandingPage() {
  const startHref = config.dataMode === "supabase" ? "/auth" : "/home";
  return (
    <div className="min-h-dvh">
      <header className="safe-top mx-auto flex max-w-5xl items-center justify-between border-b px-4 py-4 sm:px-6">
        <Wordmark />
        <Link href={startHref} className="text-sm font-medium hover:underline">
          {config.dataMode === "supabase" ? "Sign in" : "Open app"}
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="max-w-2xl pt-16 pb-20 sm:pt-24">
          <h1 className="text-[2.5rem] leading-[1.1] font-medium sm:text-[3.4rem]">
            A home for the duas you keep screenshotting.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            DuaVault turns the Islamic posts saved in your camera roll into an organised library you&apos;ll actually return to — to read,
            memorize and practise.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild size="lg" className="h-11 px-5 text-[0.95rem]">
              <Link href={startHref}>
                Get started <ArrowRight />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">Free. No account needed. Your data stays on your device.</p>
          </div>
        </section>

        <section className="border-t py-12">
          <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ title, body }, i) => (
              <li key={title}>
                <p className="text-sm text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="mt-1 text-xl font-medium">{title}</h2>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t py-16 text-center">
          <figure className="mx-auto max-w-xl">
            <blockquote>
              <p lang="ar" dir="rtl" className="arabic text-[2.1rem] leading-[2.4] text-forest sm:text-[2.75rem]">
                أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ
              </p>
              <p className="mt-5 font-display text-xl leading-relaxed text-foreground/80 italic sm:text-2xl">
                “Unquestionably, by the remembrance of Allah hearts are assured.”
              </p>
            </blockquote>
            <figcaption className="mt-4 text-sm text-muted-foreground">
              Quran 13:28
              <span className="mt-1 block text-xs text-muted-foreground/70">Arabic: Tanzil · Translation: Saheeh International</span>
            </figcaption>
          </figure>
        </section>

        <footer className="border-t py-8 text-sm leading-relaxed text-muted-foreground">
          <p className="max-w-2xl">
            DuaVault uses on-device text recognition and simple, transparent rules — not a chatbot. It never invents references, grades or
            translations, tells you when a source can&apos;t be verified, and does not issue religious rulings.
          </p>
        </footer>
      </main>
    </div>
  );
}
