"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SavedItem } from "@/core/types";
import { verifyContent } from "@/core/verify/verify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryFields, TagPicker } from "./category-fields";
import { getRepository } from "@/lib/data/repository";
import { getReferenceProvider } from "@/lib/references/static-provider";
import { errorMessage } from "@/lib/actions";

/** Render with a `key` that changes on open so the form starts from the latest item. */
export function EditItemDialog({ item, open, onOpenChange }: { item: SavedItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const textChanged =
        draft.arabicText !== item.arabicText || draft.englishText !== item.englishText || (draft.sourceText ?? "") !== (item.sourceText ?? "");
      let verification = draft.verification;
      let subcategory = draft.subcategory;
      if (textChanged) {
        const refs = getReferenceProvider();
        const [q, r] = await Promise.all([refs.getQuranMatcher(), refs.getReferenceMatcher()]);
        verification = verifyContent(
          { arabic: draft.arabicText, english: draft.englishText, sourceText: draft.sourceText ?? "" },
          q,
          r,
        ).verification;
      }
      if (draft.contentType === "hadith") subcategory = verification.status === "verified_match" ? "verified" : "unverified";
      await getRepository().updateItem(item.id, {
        title: draft.title.trim() || item.title,
        contentType: draft.contentType,
        subcategory,
        arabicText: draft.arabicText.trim(),
        englishText: draft.englishText.trim(),
        sourceText: draft.sourceText?.trim() || null,
        notes: draft.notes,
        tags: draft.tags,
        verification,
        // Transliteration stays only if the text still matches the same verified record.
        transliteration: textChanged && verification.referenceId !== item.verification.referenceId ? null : item.transliteration,
      });
      toast.success(textChanged ? "Saved — source re-checked" : "Saved");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit</DialogTitle>
          <DialogDescription>Changing the text re-checks it against the loaded datasets.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <CategoryFields
            idPrefix="edit"
            contentType={draft.contentType}
            subcategory={draft.subcategory}
            verificationStatus={draft.verification.status}
            onChange={(c) => setDraft({ ...draft, ...c })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="edit-ar">Arabic</Label>
            <Textarea
              id="edit-ar"
              dir="rtl"
              lang="ar"
              className="arabic min-h-24 text-xl"
              value={draft.arabicText}
              onChange={(e) => setDraft({ ...draft, arabicText: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-en">Translation / text</Label>
            <Textarea id="edit-en" value={draft.englishText} onChange={(e) => setDraft({ ...draft, englishText: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-src">Source as written</Label>
            <Input id="edit-src" value={draft.sourceText ?? ""} onChange={(e) => setDraft({ ...draft, sourceText: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Your notes</Label>
            <Textarea
              id="edit-notes"
              value={draft.notes}
              placeholder="Why this matters to you, when to recite it…"
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <TagPicker idPrefix="edit" tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
