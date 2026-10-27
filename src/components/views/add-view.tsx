"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Camera, ClipboardPaste, Crop, FileText, ImagePlus, Images, Loader2, ScanText, X } from "lucide-react";
import { processScreenshot, processText, reanalyzeDraft, type DraftItem, type PipelineStep } from "@/core/pipeline/pipeline";
import { getRepository } from "@/lib/data/repository";
import { getOcrEngine, pipelineDeps } from "@/lib/pipeline";
import { takePendingUploads } from "@/lib/pending-uploads";
import { errorMessage } from "@/lib/actions";
import { newId } from "@/lib/data/ids";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCEPTED_IMAGES } from "@/components/upload/quick-upload";
import { ProcessingSteps, type UploadStep } from "@/components/upload/processing-steps";
import { DraftEditor } from "@/components/upload/draft-editor";
import { CropDialog } from "@/components/upload/crop-dialog";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface Entry {
  id: string;
  file: Blob | null;
  name: string;
  previewUrl: string | null;
  status: "queued" | "processing" | "done" | "error";
  step: UploadStep;
  detail?: string;
  warnings: string[];
  removedLines: string[];
  drafts: DraftItem[];
  ocrRaw: string | null;
  error?: string;
}

function fileEntry(file: Blob, name: string): Entry {
  return {
    id: newId(),
    file,
    name,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
    step: "uploading",
    warnings: [],
    removedLines: [],
    drafts: [],
    ocrRaw: null,
  };
}

export function AddView() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [cropFor, setCropFor] = useState<Entry | null>(null);
  const [manualText, setManualText] = useState("");
  const [dragging, setDragging] = useState(false);
  const processing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, p: Partial<Entry> | ((e: Entry) => Partial<Entry>)) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...(typeof p === "function" ? p(e) : p) } : e)));
  }, []);

  const addFiles = useCallback((files: Blob[], names?: string[]) => {
    const accepted: Entry[] = [];
    files.forEach((f, i) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${names?.[i] ?? "That file"} isn't an image`);
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${names?.[i] ?? "Image"} is larger than 15 MB`);
        return;
      }
      accepted.push(fileEntry(f, names?.[i] ?? `Screenshot ${i + 1}`));
    });
    if (accepted.length) setEntries((list) => [...list, ...accepted]);
  }, []);

  // Files handed over from quick upload or the PWA share target.
  useEffect(() => {
    const pending = takePendingUploads();
    if (pending.length) queueMicrotask(() => addFiles(pending, pending.map((f) => f.name)));
    if (new URLSearchParams(window.location.search).has("shared") && "caches" in window) {
      void (async () => {
        const cache = await caches.open("duavault-share");
        const keys = await cache.keys();
        const blobs: Blob[] = [];
        for (const req of keys) {
          const res = await cache.match(req);
          if (res) blobs.push(await res.blob());
          await cache.delete(req);
        }
        if (blobs.length) addFiles(blobs);
      })();
    }
    getOcrEngine().warmUp();
  }, [addFiles]);

  // Paste from clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea, input")) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        addFiles(files, files.map((f) => f.name || "Pasted image"));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // Process queued entries one at a time.
  useEffect(() => {
    if (processing.current) return;
    const next = entries.find((e) => e.status === "queued");
    if (!next?.file) return;
    processing.current = true;
    const file = next.file;
    const onStep = (step: PipelineStep, detail?: string) => patch(next.id, { status: "processing", step, detail });
    Promise.resolve()
      .then(() => onStep("uploading"))
      .then(() => processScreenshot(file, getOcrEngine(), pipelineDeps(onStep)))
      .then((r) =>
        patch(next.id, {
          status: "done",
          step: "ready",
          drafts: r.drafts,
          warnings: r.warnings,
          removedLines: r.cleaned.removed,
          ocrRaw: r.ocr?.text ?? null,
        }),
      )
      .catch((err) =>
        patch(next.id, {
          status: "error",
          error:
            err instanceof Error && /fetch|network|load/i.test(err.message)
              ? "Couldn't download the text-recognition engine. Check your connection and try again — or type the text instead."
              : errorMessage(err),
        }),
      )
      .finally(() => {
        processing.current = false;
        setEntries((l) => [...l]); // kick the effect for the next queued entry
      });
  }, [entries, patch]);

  const runManual = async () => {
    const text = manualText.trim();
    if (!text) return;
    const entry: Entry = {
      id: newId(),
      file: null,
      name: "Typed text",
      previewUrl: null,
      status: "processing",
      step: "identifying",
      warnings: [],
      removedLines: [],
      drafts: [],
      ocrRaw: null,
    };
    setEntries((l) => [...l, entry]);
    try {
      const r = await processText(text, pipelineDeps((step) => patch(entry.id, { step })));
      patch(entry.id, { status: "done", step: "ready", drafts: r.drafts, warnings: r.warnings });
      setManualText("");
    } catch (err) {
      patch(entry.id, { status: "error", error: errorMessage(err) });
    }
  };

  const removeEntry = (id: string) =>
    setEntries((l) => {
      const e = l.find((x) => x.id === id);
      if (e?.previewUrl) URL.revokeObjectURL(e.previewUrl);
      return l.filter((x) => x.id !== id);
    });

  const saveDraft = async (entry: Entry, draft: DraftItem) => {
    setSavingId(draft.draftId);
    try {
      const item = await getRepository().createItem(
        {
          title: draft.title.trim(),
          contentType: draft.contentType,
          subcategory: draft.subcategory,
          arabicText: draft.arabicText.trim(),
          englishText: draft.englishText.trim(),
          transliteration: draft.transliteration,
          ocrRawText: entry.ocrRaw,
          ocrConfidence: draft.ocrConfidence,
          sourceText: draft.sourceText.trim() || null,
          verification: draft.verification,
          screenshotKey: null,
          tags: draft.tags,
          notes: "",
          isFavorite: false,
          reminderTime: draft.reminderTime,
        },
        entry.file,
      );
      toast.success("Saved to your library", {
        action: { label: "View", onClick: () => router.push(`/items/${item.id}`) },
      });
      const remaining = entry.drafts.filter((d) => d.draftId !== draft.draftId);
      if (remaining.length) patch(entry.id, { drafts: remaining });
      else removeEntry(entry.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const recheck = async (entry: Entry, draft: DraftItem) => {
    setRecheckingId(draft.draftId);
    try {
      const fresh = await reanalyzeDraft(draft, pipelineDeps());
      // Keep the user's own title/tags edits; refresh analysis-derived fields.
      patch(entry.id, (e) => ({
        drafts: e.drafts.map((d) =>
          d.draftId === draft.draftId
            ? {
                ...fresh,
                title: draft.title,
                tags: [...new Set([...draft.tags, ...fresh.tags])],
                reminderTime: draft.reminderTime ?? fresh.reminderTime,
              }
            : d,
        ),
      }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRecheckingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Add to your vault"
        description="Upload screenshots of duas, verses, hadith or reminders. Text is read on your device, and nothing is saved until you've reviewed it."
      />

      <Tabs defaultValue="image" className="mb-8">
        <TabsList>
          <TabsTrigger value="image">
            <ImagePlus /> Screenshot
          </TabsTrigger>
          <TabsTrigger value="text">
            <FileText /> Type or paste text
          </TabsTrigger>
        </TabsList>
        <TabsContent value="image" className="mt-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const files = [...e.dataTransfer.files];
              addFiles(files, files.map((f) => f.name));
            }}
            className={cn(
              "flex flex-col items-center rounded-lg border border-dashed border-foreground/20 px-6 py-10 text-center transition-colors",
              dragging && "border-primary bg-secondary",
            )}
          >
            <ScanText className="size-6 text-muted-foreground" strokeWidth={1.6} />
            <p className="mt-3 font-medium">Drop screenshots here</p>
            <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, WebP or HEIC · several at once is fine</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => fileInput.current?.click()}>
                <Images /> Choose images
              </Button>
              <Button variant="outline" className="sm:hidden" onClick={() => cameraInput.current?.click()}>
                <Camera /> Camera
              </Button>
              <span className="hidden items-center gap-1.5 px-2 text-sm text-muted-foreground sm:inline-flex">
                <ClipboardPaste className="size-4" /> or paste with ⌘V / Ctrl+V
              </span>
            </div>
            <input
              ref={fileInput}
              data-testid="file-input"
              type="file"
              accept={ACCEPTED_IMAGES}
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                addFiles(files, files.map((f) => f.name));
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                addFiles(files, files.map((f) => f.name));
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The first time, DuaVault downloads its text-recognition engine and Arabic + English language data (a few MB). Your images
            themselves never leave this device during recognition.
          </p>
        </TabsContent>
        <TabsContent value="text" className="mt-3 space-y-3">
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Paste or type the Arabic, the translation, and any source (e.g. Quran 2:286)…"
            className="min-h-40"
            dir="auto"
            data-testid="manual-text"
          />
          <Button onClick={runManual} disabled={!manualText.trim()}>
            <ScanText /> Organize this text
          </Button>
        </TabsContent>
      </Tabs>

      <div className="space-y-10">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.section
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="grid gap-5 lg:grid-cols-[17rem_1fr]"
              aria-label={entry.name}
            >
              <div className="space-y-3 lg:sticky lg:top-8 lg:self-start">
                {entry.previewUrl ? (
                  <div className="relative overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img src={entry.previewUrl} alt={`Preview of ${entry.name}`} className="max-h-80 w-full object-contain lg:max-h-[28rem]" />
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur hover:bg-background"
                      aria-label="Remove this screenshot"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    <FileText className="size-4" /> Typed text
                  </div>
                )}
                {entry.previewUrl && (entry.status === "done" || entry.status === "error") && (
                  <Button variant="outline" size="sm" onClick={() => setCropFor(entry)} className="w-full">
                    <Crop /> Crop and read again
                  </Button>
                )}
                {(entry.status === "processing" || entry.status === "queued") && (
                  <div className="rounded-lg border bg-card p-4">
                    {entry.status === "queued" ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Waiting…
                      </p>
                    ) : (
                      <ProcessingSteps step={entry.step} detail={entry.detail} />
                    )}
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-4">
                {entry.status === "error" && (
                  <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="space-y-2">
                      <p>{entry.error}</p>
                      {entry.file && (
                        <Button size="sm" variant="outline" onClick={() => patch(entry.id, { status: "queued", error: undefined })}>
                          Try again
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {entry.warnings.map((w, i) => (
                  <p key={i} className="flex gap-2 rounded-md bg-gold-soft px-3 py-2 text-sm text-accent-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
                  </p>
                ))}
                {entry.removedLines.length > 0 && (
                  <details className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    <summary className="cursor-pointer">Ignored {entry.removedLines.length} lines of app interface text</summary>
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {entry.removedLines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {entry.status === "done" && entry.drafts.length === 0 && (
                  <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                    Nothing to review here. Try cropping closer to the text, or use “Type or paste text”.
                    <div className="mt-3">
                      <Button size="sm" variant="ghost" onClick={() => removeEntry(entry.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
                {entry.drafts.map((draft, i) => (
                  <DraftEditor
                    key={draft.draftId}
                    draft={draft}
                    index={i}
                    total={entry.drafts.length}
                    saving={savingId === draft.draftId}
                    rechecking={recheckingId === draft.draftId}
                    onChange={(d) => patch(entry.id, (e) => ({ drafts: e.drafts.map((x) => (x.draftId === d.draftId ? d : x)) }))}
                    onRecheck={(d) => recheck(entry, d)}
                    onSave={() => saveDraft(entry, draft)}
                    onDiscard={() => {
                      const remaining = entry.drafts.filter((d) => d.draftId !== draft.draftId);
                      if (remaining.length) patch(entry.id, { drafts: remaining });
                      else removeEntry(entry.id);
                    }}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
        {entries.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Looking for something you saved? <Link href="/library" className="text-primary hover:underline">Open your library</Link>
          </p>
        )}
      </div>

      {cropFor?.previewUrl && (
        <CropDialog
          open={!!cropFor}
          onOpenChange={(o) => !o && setCropFor(null)}
          src={cropFor.previewUrl}
          onCrop={(blob) => {
            const old = cropFor;
            setCropFor(null);
            removeEntry(old.id);
            addFiles([blob], [`${old.name} (cropped)`]);
          }}
        />
      )}
    </div>
  );
}
