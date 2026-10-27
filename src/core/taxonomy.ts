import type { ContentType } from "./types";

export interface Subcategory {
  slug: string;
  label: string;
}

export interface ContentTypeDefinition {
  type: ContentType;
  label: string;
  singular: string;
  description: string;
  subcategories: Subcategory[];
  defaultSubcategory: string;
}

export const TAXONOMY: readonly ContentTypeDefinition[] = [
  {
    type: "dua",
    label: "Duas",
    singular: "Dua",
    description: "Supplications for every situation",
    defaultSubcategory: "other",
    subcategories: [
      { slug: "forgiveness", label: "Forgiveness" },
      { slug: "guidance", label: "Guidance" },
      { slug: "protection", label: "Protection" },
      { slug: "knowledge", label: "Knowledge" },
      { slug: "success", label: "Success" },
      { slug: "family", label: "Family and Parents" },
      { slug: "health", label: "Health and Healing" },
      { slug: "hardship", label: "Hardship and Patience" },
      { slug: "gratitude", label: "Gratitude" },
      { slug: "travel", label: "Travel" },
      { slug: "other", label: "Other" },
    ],
  },
  {
    type: "adhkar",
    label: "Adhkar",
    singular: "Dhikr",
    description: "Daily remembrance of Allah",
    defaultSubcategory: "daily",
    subcategories: [
      { slug: "morning", label: "Morning" },
      { slug: "evening", label: "Evening" },
      { slug: "sleep", label: "Before Sleep" },
      { slug: "after-salah", label: "After Salah" },
      { slug: "daily", label: "Daily Remembrance" },
    ],
  },
  {
    type: "quran",
    label: "Quran",
    singular: "Verse",
    description: "Verses, reflections and tafsir notes",
    defaultSubcategory: "verses",
    subcategories: [
      { slug: "verses", label: "Verses" },
      { slug: "reflections", label: "Reflections" },
      { slug: "tafsir", label: "Tafsir Notes" },
    ],
  },
  {
    type: "hadith",
    label: "Hadith",
    singular: "Hadith",
    description: "Prophetic narrations",
    // Hadith subcategory is derived from verification status, never chosen freely.
    defaultSubcategory: "unverified",
    subcategories: [
      { slug: "verified", label: "Verified Narrations" },
      { slug: "unverified", label: "Unverified Narrations" },
    ],
  },
  {
    type: "reminder",
    label: "Reminders",
    singular: "Reminder",
    description: "Islamic reminders and advice",
    defaultSubcategory: "general",
    subcategories: [
      { slug: "tawakkul", label: "Tawakkul" },
      { slug: "sabr", label: "Sabr" },
      { slug: "gratitude", label: "Gratitude" },
      { slug: "salah", label: "Salah" },
      { slug: "character", label: "Character" },
      { slug: "repentance", label: "Repentance" },
      { slug: "general", label: "General Advice" },
    ],
  },
  {
    type: "knowledge",
    label: "Knowledge",
    singular: "Lesson",
    description: "Lessons, history and learning",
    defaultSubcategory: "general",
    subcategories: [
      { slug: "lessons", label: "Lessons" },
      { slug: "history", label: "Islamic History" },
      { slug: "lectures", label: "Lectures" },
      { slug: "general", label: "General Learning" },
    ],
  },
] as const;

export const CONTENT_TYPES: ContentType[] = TAXONOMY.map((t) => t.type);

export function getTypeDefinition(type: ContentType): ContentTypeDefinition {
  const def = TAXONOMY.find((t) => t.type === type);
  if (!def) throw new Error(`Unknown content type: ${type}`);
  return def;
}

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as string[]).includes(value);
}

export function subcategoryLabel(type: ContentType, slug: string): string {
  const def = getTypeDefinition(type);
  return def.subcategories.find((s) => s.slug === slug)?.label ?? def.subcategories[0].label;
}

export function isValidSubcategory(type: ContentType, slug: string): boolean {
  return getTypeDefinition(type).subcategories.some((s) => s.slug === slug);
}

/** Normalizes a subcategory so it is always valid for the given type. */
export function coerceSubcategory(type: ContentType, slug: string | undefined): string {
  if (slug && isValidSubcategory(type, slug)) return slug;
  return getTypeDefinition(type).defaultSubcategory;
}
