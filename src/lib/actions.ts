"use client";

import { toast } from "sonner";
import type { SavedItem } from "@/core/types";
import { newProgress } from "@/core/schedule/srs";
import { getRepository } from "@/lib/data/repository";

/** Small UI-facing helpers that wrap repository calls with friendly toasts. */

export async function toggleFavorite(item: SavedItem) {
  try {
    await getRepository().updateItem(item.id, { isFavorite: !item.isFavorite });
    toast.success(item.isFavorite ? "Removed from favorites" : "Added to favorites");
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

export async function markPracticed(item: SavedItem) {
  try {
    await getRepository().recordPractice(item.id, "practiced");
    toast.success("Marked as practiced", { description: "May Allah accept it from you." });
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

export async function addToMemorization(itemId: string) {
  try {
    const repo = getRepository();
    const existing = (await repo.listProgress()).find((p) => p.itemId === itemId);
    if (existing) {
      toast("Already in your memorization list");
      return;
    }
    await repo.saveProgress(newProgress(itemId));
    toast.success("Added to your memorization list");
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
