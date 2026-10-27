import { AlertTriangle, BadgeCheck, CircleDashed, HelpCircle, Quote } from "lucide-react";
import type { VerificationStatus } from "@/core/types";
import { cn } from "@/lib/utils";

export const VERIFICATION_COPY: Record<VerificationStatus, { label: string; short: string; description: string }> = {
  verified_match: {
    label: "Verified reference match",
    short: "Verified match",
    description: "The Arabic text matches a record in a trusted dataset loaded in DuaVault.",
  },
  possible_match: {
    label: "Possible match — compare",
    short: "Possible match",
    description: "Similar to a trusted record but not identical. OCR errors or different wording may explain it.",
  },
  user_provided_unverified: {
    label: "Source given, not independently verified",
    short: "Source not verified",
    description: "A reference was written on the post or by you, but DuaVault could not confirm it.",
  },
  unverified: {
    label: "Unverified",
    short: "Unverified",
    description: "No source was found and the text did not match a loaded dataset.",
  },
  review_required: {
    label: "Review required",
    short: "Needs review",
    description: "Something doesn't line up — for example, the cited reference doesn't match the text.",
  },
};

const STYLES: Record<VerificationStatus, { icon: typeof BadgeCheck; className: string }> = {
  verified_match: { icon: BadgeCheck, className: "text-success" },
  possible_match: { icon: CircleDashed, className: "text-warning" },
  user_provided_unverified: { icon: Quote, className: "text-muted-foreground" },
  unverified: { icon: HelpCircle, className: "text-muted-foreground" },
  review_required: { icon: AlertTriangle, className: "text-destructive" },
};

export function VerificationBadge({ status, compact = false, className }: { status: VerificationStatus; compact?: boolean; className?: string }) {
  const { icon: Icon, className: tone } = STYLES[status];
  const copy = VERIFICATION_COPY[status];
  return (
    <span
      title={copy.description}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2} />
      {compact ? copy.short : copy.label}
    </span>
  );
}
