import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow = "DuaVault",
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-5 pb-2", className)}>
      <div className="min-w-0">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-4xl leading-tight font-medium sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeading({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-2xl font-medium">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sanctuary-panel px-6 py-12 text-center sm:py-16", className)}>
      <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"><Icon aria-hidden="true" className="size-7 text-primary" strokeWidth={1.5} /></span>
      <h3 className="text-2xl font-medium">{title}</h3>
      {description && <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ArabicText({ children, size = "lg", className }: { children: string; size?: "md" | "lg" | "xl"; className?: string }) {
  return (
    <p
      lang="ar"
      dir="rtl"
      className={cn(
        "arabic text-right whitespace-pre-line text-foreground",
        size === "md" && "text-xl",
        size === "lg" && "text-2xl sm:text-[1.7rem]",
        size === "xl" && "text-[1.75rem] sm:text-[2.1rem]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl leading-none font-medium text-primary tabular-nums">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
