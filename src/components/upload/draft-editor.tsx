"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Copy, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import type { DraftItem } from "@/core/pipeline/pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryFields, TagPicker } from "@/components/items/category-fields";
import { VerificationPanel } from "@/components/items/verification-panel";
import { cn } from "@/lib/utils";
import { suggestedReminderTime } from "@/core/schedule/reminders";
import { ReminderControl } from "@/components/reminders/reminder-control";

export function DraftEditor({
  draft,
  index,
  total,
  onChange,
  onRecheck,
  onSave,
  onDiscard,
  saving,
  rechecking,
}: {
  draft: DraftItem;
  index: number;
  total: number;
  onChange: (d: DraftItem) => void;
  onRecheck: (d: DraftItem) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  rechecking: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  const id = draft.draftId;
  const update = (patch: Partial<DraftItem>, textChanged = false) => {
    onChange({ ...draft, ...patch });
    if (textChanged) setDirty(true);
  };
  const lowConfidence = draft.classification.confidence < 0.45;

  return (
    <article className="paper-card space-y-5 p-4 sm:p-6" data-testid="draft-editor" aria-label={`Item ${index + 1} of ${total}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {total > 1 ? `Item ${index + 1} of ${total}` : "Review before saving"}
        </p>
        <span
          className={cn("text-xs", lowConfidence ? "text-warning" : "text-muted-foreground")}
          title={draft.classification.reasons.join(" · ")}
        >
          Category guess: {Math.round(draft.classification.confidence * 100)}% sure
          {draft.ocrConfidence !== null && ` · Text read at ${Math.round(draft.ocrConfidence)}% confidence`}
        </span>
      </div>

      {draft.duplicates.length > 0 && (
        <div className="flex gap-3 rounded-md border border-gold/40 bg-gold-soft p-3 text-sm">
          <Copy className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
          <div>
            <p className="font-medium text-accent-foreground">You may already have this saved</p>
            <ul className="mt-1 space-y-0.5">
              {draft.duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/items/${d.id}`} className="underline underline-offset-2" target="_blank">
                    {d.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">({Math.round(d.similarity * 100)}% similar)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {draft.lowConfidenceLines.length > 0 && (
        <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Some lines were hard to read — please check them:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {draft.lowConfidenceLines.slice(0, 5).map((l, i) => (
                <li key={i} dir="auto">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input id={`${id}-title`} value={draft.title} onChange={(e) => update({ title: e.target.value })} maxLength={200} />
      </div>

      <CategoryFields
        idPrefix={id}
        contentType={draft.contentType}
        subcategory={draft.subcategory}
        verificationStatus={draft.verification.status}
        onChange={(c) => {
          // Re-categorising as morning/evening adhkar suggests a matching reminder.
          const next = { ...draft, ...c };
          update({ ...c, reminderTime: draft.reminderTime ?? suggestedReminderTime(next) });
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-ar`}>Arabic</Label>
        <Textarea
          id={`${id}-ar`}
          dir="rtl"
          lang="ar"
          value={draft.arabicText}
          onChange={(e) => update({ arabicText: e.target.value }, true)}
          placeholder="Arabic text (if any)"
          className="arabic min-h-28 text-xl leading-loose"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-en`}>Translation / text</Label>
        <Textarea
          id={`${id}-en`}
          value={draft.englishText}
          onChange={(e) => update({ englishText: e.target.value }, true)}
          placeholder="English text or translation"
          className="min-h-24"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-src`}>Source as written on the post</Label>
        <Input
          id={`${id}-src`}
          value={draft.sourceText}
          onChange={(e) => update({ sourceText: e.target.value }, true)}
          placeholder="e.g. Quran 2:286, Sahih Muslim — leave empty if none"
        />
      </div>

      {draft.transliteration && (
        <div className="space-y-1.5">
          <Label>Transliteration (from dataset)</Label>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm italic">{draft.transliteration}</p>
        </div>
      )}

      <VerificationPanel
        verification={draft.verification}
        suggestion={draft.suggestion}
        onUseSuggestion={
          draft.suggestion
            ? () => {
                const s = draft.suggestion!;
                const next = {
                  ...draft,
                  arabicText: s.arabic,
                  englishText: draft.englishText.trim() ? draft.englishText : (s.translation ?? ""),
                };
                onRecheck(next);
                setDirty(false);
              }
            : undefined
        }
      />
      {dirty && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onRecheck(draft);
            setDirty(false);
          }}
          disabled={rechecking}
        >
          {rechecking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-check category and source
        </Button>
      )}

      <TagPicker idPrefix={id} tags={draft.tags} onChange={(tags) => update({ tags })} />

      <ReminderControl
        idPrefix={id}
        value={draft.reminderTime}
        suggested={suggestedReminderTime(draft)}
        onChange={(reminderTime) => update({ reminderTime })}
      />

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button onClick={onSave} disabled={saving || (!draft.arabicText.trim() && !draft.englishText.trim()) || !draft.title.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save to library
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          <Trash2 /> Discard
        </Button>
      </div>
    </article>
  );
}
