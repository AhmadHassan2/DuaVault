import { cn } from "@/lib/utils";

/** An eight-point star (khatam) cradling a small lamp-like dot. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect x="2" y="2" width="28" height="28" rx="9" className="fill-primary" />
      <path
        d="M16 7.5l2.6 5.9 5.9 2.6-5.9 2.6-2.6 5.9-2.6-5.9-5.9-2.6 5.9-2.6z"
        className="fill-primary-foreground"
        opacity="0.95"
      />
      <circle cx="16" cy="16" r="2.1" className="fill-gold" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-xl font-medium tracking-tight">DuaVault</span>
    </span>
  );
}
