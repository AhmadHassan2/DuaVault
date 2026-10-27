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
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:border-foreground/25",
        dragging && "border-primary bg-secondary",
        className,
      )}
    >
      <ImagePlus className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
      <span>
        <span className="block text-sm font-medium">Save a screenshot</span>
        <span className="block text-xs text-muted-foreground">Choose or drop images</span>
      </span>
      <input ref={input} type="file" accept={ACCEPTED_IMAGES} multiple hidden onChange={(e) => handle(e.target.files)} />
    </button>
  );
}
