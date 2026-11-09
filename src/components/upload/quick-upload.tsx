"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { setPendingUploads } from "@/lib/pending-uploads";
import { cn } from "@/lib/utils";

export const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif";

export function QuickUpload({ className }: { className?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setPendingUploads(list);
    router.push("/add?from=quick");
  };

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "group flex w-full flex-col items-start gap-5 rounded-2xl border border-primary/25 bg-gold-soft/40 p-6 text-left transition-colors hover:border-primary/60 hover:bg-gold-soft/65 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        dragging && "border-primary bg-secondary",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ImagePlus aria-hidden="true" className="size-6 shrink-0" strokeWidth={1.8} /></span>
      <span>
        <span className="block font-display text-2xl font-medium">Save a screenshot</span>
        <span className="mt-2 block text-sm text-muted-foreground">Save a dua or Islamic reminder.</span>
        <span className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Choose or drop images</span>
      </span>
      <input ref={input} type="file" accept={ACCEPTED_IMAGES} multiple hidden onChange={(e) => handle(e.target.files)} />
    </button>
  );
}
