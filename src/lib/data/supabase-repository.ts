import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Collection,
  ContentType,
  JournalEntry,
  MemorizationProgress,
  MemorizationState,
  NewSavedItem,
  PracticeEvent,
  PracticeKind,
  SavedItem,
  VerificationStatus,
} from "@/core/types";
import {
  DEFAULT_REMINDER_PREFERENCES,
  type ExportBundle,
  type ItemPatch,
  type ReminderPreferences,
  type Repository,
} from "@/core/data/repository";
import { normalizeArabic } from "@/core/text/arabic";
import { emitDataChange } from "./events";
import { newId } from "./ids";

const BUCKET = "screenshots";
const SIGNED_URL_TTL = 60 * 10;

interface ItemRow {
  id: string;
  owner_id: string;
  title: string;
  content_type: ContentType;
  subcategory: string;
  arabic_text: string;
  english_text: string;
  transliteration: string | null;
  ocr_raw_text: string | null;
  ocr_confidence: number | null;
  source_text: string | null;
  notes: string;
  verification_status: VerificationStatus;
  verification_reference_id: string | null;
  verification_reference_label: string | null;
  verification_source_name: string | null;
  verification_match_score: number | null;
  verification_match_kind: "exact" | "partial" | "possible" | null;
  verification_grade: string | null;
  verification_grade_source: string | null;
  verification_notes: string[];
  verification_checked_at: string;
  screenshot_path: string | null;
  is_favorite: boolean;
  reminder_time: string | null;
  practice_count: number;
  created_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
  saved_item_tags?: Array<{ tags: { slug: string } | null }>;
}

const ITEM_SELECT = "*, saved_item_tags(tags(slug))";

function rowToItem(r: ItemRow): SavedItem {
  return {
    id: r.id,
    title: r.title,
    contentType: r.content_type,
    subcategory: r.subcategory,
    arabicText: r.arabic_text,
    englishText: r.english_text,
    transliteration: r.transliteration,
    ocrRawText: r.ocr_raw_text,
    ocrConfidence: r.ocr_confidence,
    sourceText: r.source_text,
    notes: r.notes,
    verification: {
      status: r.verification_status,
      referenceId: r.verification_reference_id ?? undefined,
      referenceLabel: r.verification_reference_label ?? undefined,
      sourceName: r.verification_source_name ?? undefined,
      matchScore: r.verification_match_score ?? undefined,
      matchKind: r.verification_match_kind ?? undefined,
      grade: r.verification_grade ?? undefined,
      gradeSource: r.verification_grade_source ?? undefined,
      notes: r.verification_notes ?? [],
      checkedAt: r.verification_checked_at,
    },
    screenshotKey: r.screenshot_path,
    tags: (r.saved_item_tags ?? []).map((t) => t.tags?.slug).filter((s): s is string => !!s),
    isFavorite: r.is_favorite,
    reminderTime: r.reminder_time ? r.reminder_time.slice(0, 5) : null,
    practiceCount: r.practice_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastReviewedAt: r.last_reviewed_at,
  };
}

function itemToRow(i: ItemPatch): Partial<ItemRow> & { arabic_normalized?: string } {
  const row: Partial<ItemRow> & { arabic_normalized?: string } = {};
  if (i.title !== undefined) row.title = i.title;
  if (i.contentType !== undefined) row.content_type = i.contentType;
  if (i.subcategory !== undefined) row.subcategory = i.subcategory;
  if (i.arabicText !== undefined) {
    row.arabic_text = i.arabicText;
    row.arabic_normalized = normalizeArabic(i.arabicText);
  }
  if (i.englishText !== undefined) row.english_text = i.englishText;
  if (i.transliteration !== undefined) row.transliteration = i.transliteration;
  if (i.ocrRawText !== undefined) row.ocr_raw_text = i.ocrRawText;
  if (i.ocrConfidence !== undefined) row.ocr_confidence = i.ocrConfidence;
  if (i.sourceText !== undefined) row.source_text = i.sourceText;
  if (i.notes !== undefined) row.notes = i.notes;
  if (i.isFavorite !== undefined) row.is_favorite = i.isFavorite;
  if (i.reminderTime !== undefined) row.reminder_time = i.reminderTime;
  if (i.screenshotKey !== undefined) row.screenshot_path = i.screenshotKey;
  if (i.verification !== undefined) {
    const v = i.verification;
    row.verification_status = v.status;
    row.verification_reference_id = v.referenceId ?? null;
    row.verification_reference_label = v.referenceLabel ?? null;
    row.verification_source_name = v.sourceName ?? null;
    row.verification_match_score = v.matchScore ?? null;
    row.verification_match_kind = v.matchKind ?? null;
    row.verification_grade = v.grade ?? null;
    row.verification_grade_source = v.gradeSource ?? null;
    row.verification_notes = v.notes;
    row.verification_checked_at = v.checkedAt;
  }
  return row;
}

function fail(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function extensionFor(blob: Blob): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[blob.type] ?? "png";
}

export class SupabaseRepository implements Repository<Blob> {
  readonly mode = "supabase" as const;

  constructor(private readonly client: SupabaseClient) {}

  private async userId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error("You need to sign in.");
    return data.user.id;
  }

  private async syncTags(itemId: string, tags: string[]): Promise<void> {
    const slugs = [...new Set(tags.map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40)).filter(Boolean))];
    fail((await this.client.from("saved_item_tags").delete().eq("item_id", itemId)).error, "Updating tags");
    if (!slugs.length) return;
    const { data, error } = await this.client
      .from("tags")
      .upsert(slugs.map((slug) => ({ slug })), { onConflict: "owner_id,slug" })
      .select("id, slug");
    fail(error, "Saving tags");
    const rows = (data ?? []).map((t: { id: string }) => ({ item_id: itemId, tag_id: t.id }));
    fail((await this.client.from("saved_item_tags").insert(rows)).error, "Linking tags");
  }

  async listItems(): Promise<SavedItem[]> {
    const { data, error } = await this.client.from("saved_items").select(ITEM_SELECT).order("created_at", { ascending: false });
    fail(error, "Loading library");
    return (data as ItemRow[]).map(rowToItem);
  }

  async getItem(id: string): Promise<SavedItem | null> {
    const { data, error } = await this.client.from("saved_items").select(ITEM_SELECT).eq("id", id).maybeSingle();
    fail(error, "Loading item");
    return data ? rowToItem(data as ItemRow) : null;
  }

  async createItem(input: NewSavedItem, screenshot?: Blob | null): Promise<SavedItem> {
    const uid = await this.userId();
    const id = newId();
    let screenshotPath: string | null = null;
    if (screenshot) {
      screenshotPath = `${uid}/${id}.${extensionFor(screenshot)}`;
      const { error } = await this.client.storage.from(BUCKET).upload(screenshotPath, screenshot, {
        contentType: screenshot.type || "image/png",
        upsert: false,
      });
      fail(error, "Uploading screenshot");
    }
    const { data, error } = await this.client
      .from("saved_items")
      .insert({ id, ...itemToRow({ ...input, screenshotKey: screenshotPath }) })
      .select(ITEM_SELECT)
      .single();
    if (error && screenshotPath) await this.client.storage.from(BUCKET).remove([screenshotPath]);
    fail(error, "Saving item");
    await this.syncTags(id, input.tags);
    emitDataChange();
    return { ...rowToItem(data as ItemRow), tags: input.tags };
  }

  async updateItem(id: string, patch: ItemPatch): Promise<SavedItem> {
    const row = itemToRow(patch);
    if (Object.keys(row).length) {
      fail((await this.client.from("saved_items").update(row).eq("id", id)).error, "Updating item");
    }
    if (patch.tags) await this.syncTags(id, patch.tags);
    const item = await this.getItem(id);
    if (!item) throw new Error("Item not found");
    emitDataChange();
    return item;
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.getItem(id);
    fail((await this.client.from("saved_items").delete().eq("id", id)).error, "Deleting item");
    if (item?.screenshotKey) await this.client.storage.from(BUCKET).remove([item.screenshotKey]);
    emitDataChange();
  }

  async getScreenshotUrl(key: string): Promise<string | null> {
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUrl(key, SIGNED_URL_TTL);
    if (error) return null;
    return data.signedUrl;
  }

  async listCollections(): Promise<Collection[]> {
    const { data, error } = await this.client
      .from("collections")
      .select("id, name, description, created_at, updated_at, collection_items(item_id)")
      .order("name");
    fail(error, "Loading collections");
    return (data ?? []).map((c: {
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
      collection_items: Array<{ item_id: string }>;
    }) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      itemIds: c.collection_items.map((x) => x.item_id),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  async createCollection(name: string, description = ""): Promise<Collection> {
    const { data, error } = await this.client
      .from("collections")
      .insert({ name: name.trim(), description: description.trim() })
      .select()
      .single();
    fail(error, "Creating collection");
    emitDataChange();
    return { id: data.id, name: data.name, description: data.description, itemIds: [], createdAt: data.created_at, updatedAt: data.updated_at };
  }

  async updateCollection(id: string, patch: { name?: string; description?: string }): Promise<Collection> {
    fail((await this.client.from("collections").update(patch).eq("id", id)).error, "Updating collection");
    const c = (await this.listCollections()).find((x) => x.id === id);
    if (!c) throw new Error("Collection not found");
    emitDataChange();
    return c;
  }

  async deleteCollection(id: string): Promise<void> {
    fail((await this.client.from("collections").delete().eq("id", id)).error, "Deleting collection");
    emitDataChange();
  }

  async setCollectionMembership(collectionId: string, itemId: string, member: boolean): Promise<void> {
    const q = member
      ? this.client.from("collection_items").upsert({ collection_id: collectionId, item_id: itemId }, { onConflict: "collection_id,item_id" })
      : this.client.from("collection_items").delete().eq("collection_id", collectionId).eq("item_id", itemId);
    fail((await q).error, "Updating collection");
    emitDataChange();
  }

  async recordPractice(itemId: string, kind: PracticeKind, rating?: MemorizationState): Promise<void> {
    const { error } = await this.client.rpc("record_practice", { p_item_id: itemId, p_kind: kind, p_rating: rating ?? null });
    fail(error, "Recording practice");
    emitDataChange();
  }

  async listPractice(): Promise<PracticeEvent[]> {
    const { data, error } = await this.client
      .from("practice_history")
      .select("id, item_id, kind, rating, at")
      .order("at", { ascending: false })
      .limit(1000);
    fail(error, "Loading practice history");
    return (data ?? []).map((p: { id: string; item_id: string; kind: PracticeKind; rating: MemorizationState | null; at: string }) => ({
      id: p.id,
      itemId: p.item_id,
      kind: p.kind,
      rating: p.rating ?? undefined,
      at: p.at,
    }));
  }

  async listProgress(): Promise<MemorizationProgress[]> {
    const { data, error } = await this.client.from("memorization_progress").select("*");
    fail(error, "Loading memorization progress");
    return (data ?? []).map((p: {
      item_id: string;
      state: MemorizationState;
      ease: number;
      interval_days: number;
      repetitions: number;
      due_at: string;
      last_reviewed_at: string | null;
    }) => ({
      itemId: p.item_id,
      state: p.state,
      ease: p.ease,
      intervalDays: p.interval_days,
      repetitions: p.repetitions,
      dueAt: p.due_at,
      lastReviewedAt: p.last_reviewed_at,
    }));
  }

  async saveProgress(p: MemorizationProgress): Promise<void> {
    const { error } = await this.client.from("memorization_progress").upsert(
      {
        item_id: p.itemId,
        state: p.state,
        ease: p.ease,
        interval_days: p.intervalDays,
        repetitions: p.repetitions,
        due_at: p.dueAt,
        last_reviewed_at: p.lastReviewedAt,
      },
      { onConflict: "owner_id,item_id" },
    );
    fail(error, "Saving progress");
    emitDataChange();
  }

  async removeProgress(itemId: string): Promise<void> {
    fail((await this.client.from("memorization_progress").delete().eq("item_id", itemId)).error, "Removing progress");
    emitDataChange();
  }

  async listJournal(): Promise<JournalEntry[]> {
    const { data, error } = await this.client.from("journal_entries").select("*").order("updated_at", { ascending: false });
    fail(error, "Loading journal");
    return (data ?? []).map(journalFromRow);
  }

  async getJournal(id: string): Promise<JournalEntry | null> {
    const { data, error } = await this.client.from("journal_entries").select("*").eq("id", id).maybeSingle();
    fail(error, "Loading journal entry");
    return data ? journalFromRow(data) : null;
  }

  async saveJournal(entry: Omit<JournalEntry, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<JournalEntry> {
    const row = {
      title: entry.title,
      body: entry.body,
      arabic_text: entry.arabicText,
      topic: entry.topic,
      reminder_enabled: entry.reminderEnabled,
      reminder_time: entry.reminderTime,
    };
    const q = entry.id
      ? this.client.from("journal_entries").update(row).eq("id", entry.id).select().single()
      : this.client.from("journal_entries").insert(row).select().single();
    const { data, error } = await q;
    fail(error, "Saving journal entry");
    emitDataChange();
    return journalFromRow(data);
  }

  async deleteJournal(id: string): Promise<void> {
    fail((await this.client.from("journal_entries").delete().eq("id", id)).error, "Deleting journal entry");
    emitDataChange();
  }

  async getReminderPreferences(): Promise<ReminderPreferences> {
    const { data } = await this.client.from("reminder_preferences").select("*").maybeSingle();
    if (!data) return DEFAULT_REMINDER_PREFERENCES;
    return { dailyReminderEnabled: data.daily_reminder_enabled, dailyReminderTime: String(data.daily_reminder_time).slice(0, 5) };
  }

  async saveReminderPreferences(prefs: ReminderPreferences): Promise<void> {
    const { error } = await this.client.from("reminder_preferences").upsert(
      { daily_reminder_enabled: prefs.dailyReminderEnabled, daily_reminder_time: prefs.dailyReminderTime },
      { onConflict: "owner_id" },
    );
    fail(error, "Saving reminder preferences");
    emitDataChange();
  }

  async exportAll(): Promise<ExportBundle> {
    return {
      exportedAt: new Date().toISOString(),
      app: "DuaVault",
      items: await this.listItems(),
      collections: await this.listCollections(),
      practice: await this.listPractice(),
      progress: await this.listProgress(),
      journal: await this.listJournal(),
    };
  }

  async deleteAll(): Promise<void> {
    const uid = await this.userId();
    const items = await this.listItems();
    const paths = items.map((i) => i.screenshotKey).filter((p): p is string => !!p);
    if (paths.length) await this.client.storage.from(BUCKET).remove(paths);
    for (const table of ["saved_items", "collections", "journal_entries", "tags", "reminder_preferences"]) {
      fail((await this.client.from(table).delete().eq("owner_id", uid)).error, `Deleting ${table}`);
    }
    emitDataChange();
  }
}

function journalFromRow(r: {
  id: string;
  title: string;
  body: string;
  arabic_text: string;
  topic: string;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: string;
  updated_at: string;
}): JournalEntry {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    arabicText: r.arabic_text,
    topic: r.topic,
    reminderEnabled: r.reminder_enabled,
    reminderTime: r.reminder_time ? r.reminder_time.slice(0, 5) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
