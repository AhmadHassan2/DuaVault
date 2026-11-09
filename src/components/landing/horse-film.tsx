"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function HorseFilm({ src, poster }: { src: string; poster: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const manuallyPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const syncPlayback = () => {
      if (!visible || document.hidden || reducedMotion.matches || manuallyPaused.current) {
        player.pause();
      } else {
        void player.play().catch(() => undefined);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.15 });
    observer.observe(player);
    reducedMotion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      player.pause();
    };
  }, []);

  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-paper shadow-2xl shadow-background/20 sm:rounded-[2.5rem]">
      <video
        ref={video}
        src={src}
        poster={poster}
        width={1280}
        height={720}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="A man riding a galloping horse through a green valley at dawn"
        className="aspect-[16/9] w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setUnavailable(true)}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(9,24,15,0.65),transparent_45%)]" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-[#f0eadb] sm:p-7">
        <p className="max-w-52 text-xs leading-relaxed opacity-90 sm:max-w-none sm:text-sm">{unavailable ? "Animation unavailable. Please refresh to try again." : "A journey through the green valley"}</p>
        {!unavailable && <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#f0eadb]/40 bg-[#102419]/80 px-4 text-sm backdrop-blur-sm transition-colors hover:bg-[#102419] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f0eadb]"
          aria-label={playing ? "Pause horse animation" : "Play horse animation"}
          onClick={() => {
            const player = video.current;
            if (!player) return;
            if (player.paused) {
              manuallyPaused.current = false;
              void player.play().catch(() => setUnavailable(true));
            } else {
              manuallyPaused.current = true;
              player.pause();
            }
          }}
        >
          {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
          <span className="hidden sm:inline">{playing ? "Pause" : "Play"}</span>
        </button>}
      </div>
    </div>
  );
}
