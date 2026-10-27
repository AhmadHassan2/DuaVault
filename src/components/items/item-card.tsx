"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { MemorizationState, SavedItem } from "@/core/types";
import { getTypeDefinition, subcategoryLabel } from "@/core/taxonomy";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "./verification-badge";
import { relativeTime } from "@/lib/format";

export function TypeLabel({ item, className }: { item: Pick<SavedItem, "contentType" | "subcategory">; className?: string }) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {getTypeDefinition(item.contentType).singular} · {subcategoryLabel(item.contentType, item.subcategory)}
    </span>
  );
}

export function ItemCard({
  item,
  memorization,
  className,
}: {
  item: SavedItem;
  memorization?: MemorizationState;
  className?: string;
}) {
  return (
    <Link
      href={`/items/${item.id}`}
      className={cn(
        "paper-card group flex h-full flex-col gap-2.5 p-4 transition-colors hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <TypeLabel item={item} />
        {item.isFavorite && <Heart className="size-4 shrink-0 fill-gold text-gold" aria-label="Favorite" />}
      </div>
      <h3 className="line-clamp-2 font-display text-lg leading-snug font-medium group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{item.title}</h3>
      {item.arabicText && (
        <p lang="ar" dir="rtl" className="arabic line-clamp-2 text-right text-xl leading-[2] text-foreground/90">
          {item.arabicText}
        </p>
      )}
      {item.englishText && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.englishText}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <VerificationBadge status={item.verification.status} compact />
        {memorization && memorization !== "not_started" && (
          <span className="text-[11px] text-muted-foreground capitalize">· {memorization}</span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {item.lastReviewedAt ? `Revisited ${relativeTime(item.lastReviewedAt)}` : `Saved ${relativeTime(item.createdAt)}`}
        </span>
      </div>
    </Link>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="paper-card flex h-48 flex-col gap-3 p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-6 w-full animate-pulse rounded bg-muted/70" />
      <div className="mt-auto h-4 w-28 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
