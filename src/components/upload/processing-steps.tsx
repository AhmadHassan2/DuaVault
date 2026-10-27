"use client";

import { Check, Loader2 } from "lucide-react";
import type { PipelineStep } from "@/core/pipeline/pipeline";
import { cn } from "@/lib/utils";

export type UploadStep = "uploading" | PipelineStep;

const STEPS: Array<{ id: UploadStep; label: string }> = [
  { id: "uploading", label: "Uploading" },
  { id: "reading", label: "Reading text" },
  { id: "identifying", label: "Identifying content" },
  { id: "organizing", label: "Organizing" },
  { id: "ready", label: "Ready to save" },
];

export function ProcessingSteps({ step, detail, className }: { step: UploadStep; detail?: string; className?: string }) {
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className={cn("space-y-2.5", className)} aria-label="Processing progress">
      {STEPS.map((s, i) => {
        const done = i < current || step === "ready";
        const active = i === current && step !== "ready";
        return (
          <li key={s.id} className="flex items-center gap-3 text-sm" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
            </span>
            <span className={cn(done || active ? "text-foreground" : "text-muted-foreground", active && "font-medium")}>
              {s.label}
              {active && detail && <span className="ml-2 text-muted-foreground tabular-nums">{detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
