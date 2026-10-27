import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  /** Accepted for call-site compatibility; intentionally not rendered. */
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5", className)}>
      <div className="min-w-0">
        <h1 className="text-[2rem] leading-tight font-medium sm:text-[2.4rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-[0.95rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeading({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-xl font-medium">{title}</h2>
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
    <div className={cn("rounded-lg border px-6 py-12 text-center", className)}>
      <Icon className="mx-auto mb-3 size-5 text-muted-foreground" strokeWidth={1.6} />
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
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
      <div className="text-lg leading-none font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
