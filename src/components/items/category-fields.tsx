"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ContentType, VerificationStatus } from "@/core/types";
import { TAXONOMY, getTypeDefinition } from "@/core/taxonomy";
import { TOPICS, topicLabel } from "@/core/classify/topics";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function CategoryFields({
  contentType,
  subcategory,
  verificationStatus,
  onChange,
  idPrefix,
}: {
  contentType: ContentType;
  subcategory: string;
  verificationStatus: VerificationStatus;
  onChange: (next: { contentType: ContentType; subcategory: string }) => void;
  idPrefix: string;
}) {
  const def = getTypeDefinition(contentType);
  const hadithLocked = contentType === "hadith";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`}>Category</Label>
        <Select
          value={contentType}
          onValueChange={(v) => {
            const type = v as ContentType;
            const sub =
              type === "hadith"
                ? verificationStatus === "verified_match"
                  ? "verified"
                  : "unverified"
                : getTypeDefinition(type).defaultSubcategory;
            onChange({ contentType: type, subcategory: sub });
          }}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAXONOMY.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-sub`}>Subcategory</Label>
        <Select value={subcategory} disabled={hadithLocked} onValueChange={(v) => onChange({ contentType, subcategory: v })}>
          <SelectTrigger id={`${idPrefix}-sub`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {def.subcategories.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hadithLocked && (
          <p className="text-xs text-muted-foreground">Set automatically: only dataset-verified narrations count as “Verified”.</p>
        )}
      </div>
    </div>
  );
}

export function TagPicker({ tags, onChange, idPrefix }: { tags: string[]; onChange: (tags: string[]) => void; idPrefix: string }) {
  const [custom, setCustom] = useState("");
  const [showAll, setShowAll] = useState(false);
  const suggestions = TOPICS.map((t) => t.slug).filter((s) => !tags.includes(s));
  const visible = showAll ? suggestions : suggestions.slice(0, 8);

  const add = (slug: string) => {
    const clean = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-tag`}>Topics</Label>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground"
            aria-label={`Remove topic ${topicLabel(t)}`}
          >
            {topicLabel(t)} <X className="size-3" />
          </button>
        ))}
        {visible.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => add(t)}
            className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground")}
          >
            <Plus className="size-3" /> {topicLabel(t)}
          </button>
        ))}
        {suggestions.length > 8 && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="px-1.5 text-xs text-primary hover:underline">
            {showAll ? "Fewer" : "More topics"}
          </button>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(custom);
          setCustom("");
        }}
      >
        <Input id={`${idPrefix}-tag`} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own topic" className="h-8" />
      </form>
    </div>
  );
}
