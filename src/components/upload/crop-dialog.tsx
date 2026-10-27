"use client";

import { useRef, useState } from "react";
import { Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Touch-friendly crop: drag on the image to select the area with the text.
 * Cropping away usernames, captions and buttons noticeably improves OCR.
 */
export function CropDialog({
  open,
  onOpenChange,
  src,
  onCrop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  onCrop: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const point = (e: React.PointerEvent) => {
    const box = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  const apply = async () => {
    const img = imgRef.current;
    if (!img || !rect || rect.w < 0.02 || rect.h < 0.02) return;
    const canvas = document.createElement("canvas");
    const sx = rect.x * img.naturalWidth;
    const sy = rect.y * img.naturalHeight;
    canvas.width = Math.round(rect.w * img.naturalWidth);
    canvas.height = Math.round(rect.h * img.naturalHeight);
    canvas.getContext("2d")!.drawImage(img, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => b && onCrop(b), "image/png");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop to the text</DialogTitle>
          <DialogDescription>Drag over the part of the screenshot you want to keep.</DialogDescription>
        </DialogHeader>
        <div
          className="relative mx-auto w-fit touch-none select-none"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            start.current = point(e);
            setRect({ ...start.current, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const p = point(e);
            setRect({
              x: Math.min(p.x, start.current.x),
              y: Math.min(p.y, start.current.y),
              w: Math.abs(p.x - start.current.x),
              h: Math.abs(p.y - start.current.y),
            });
          }}
          onPointerUp={() => (start.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img ref={imgRef} src={src} alt="Screenshot to crop" className="max-h-[60dvh] rounded-lg" draggable={false} />
          {rect && rect.w > 0 && (
            <div
              className="pointer-events-none absolute border-2 border-gold shadow-[0_0_0_9999px_rgba(20,30,25,0.45)]"
              style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!rect || rect.w < 0.02 || rect.h < 0.02}>
            <Crop /> Crop and re-read
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
