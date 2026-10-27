"use client";

import { Info } from "lucide-react";
import type { VerificationInfo } from "@/core/types";
import type { VerificationOutcome } from "@/core/verify/verify";
import { Button } from "@/components/ui/button";
import { ArabicText } from "@/components/common";
import { VERIFICATION_COPY, VerificationBadge } from "./verification-badge";

export function VerificationPanel({
  verification,
  suggestion,
  onUseSuggestion,
}: {
  verification: VerificationInfo;
  suggestion?: VerificationOutcome["suggestion"];
  onUseSuggestion?: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/40 p-4" data-testid="verification-panel">
      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadge status={verification.status} />
        {verification.referenceLabel && verification.status !== "review_required" && (
          <span className="text-sm font-medium">{verification.referenceLabel}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{VERIFICATION_COPY[verification.status].description}</p>
      {verification.notes.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {verification.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
      {verification.grade && verification.gradeSource && (
        <p className="text-sm">
          Grade: <strong>{verification.grade}</strong> <span className="text-muted-foreground">(as recorded by {verification.gradeSource})</span>
        </p>
      )}
      {suggestion && onUseSuggestion && (
        <div className="space-y-2 rounded-lg border border-dashed bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Dataset wording — {suggestion.label}</p>
          <ArabicText size="md">{suggestion.arabic}</ArabicText>
          {suggestion.translation && <p className="text-sm text-muted-foreground">{suggestion.translation}</p>}
          <Button size="sm" variant="secondary" onClick={onUseSuggestion}>
            Use dataset wording
          </Button>
          <p className="text-[11px] text-muted-foreground">Only use this if it is what your screenshot says.</p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        A match means the wording appears in a loaded dataset. It is not a ruling, and similarity scores are not proof of authenticity.
      </p>
    </div>
  );
}
