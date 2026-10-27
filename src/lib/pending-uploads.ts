"use client";

/** Hands files from quick-upload / share-target to the /add flow across client navigation. */
let pending: File[] = [];

export function setPendingUploads(files: File[]): void {
  pending = files;
}

export function takePendingUploads(): File[] {
  const f = pending;
  pending = [];
  return f;
}
