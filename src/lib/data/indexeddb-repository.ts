import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Collection,
  JournalEntry,
  MemorizationProgress,
  MemorizationState,
  NewSavedItem,
  PracticeEvent,
  PracticeKind,
  SavedItem,
} from "@/core/types";
import {
  DEFAULT_REMINDER_PREFERENCES,
  type ExportBundle,
  type ItemPatch,
  type ReminderPreferences,
  type Repository,
} from "@/core/data/repository";
import { emitDataChange } from "./events";
import { newId } from "./ids";

interface DuaVaultDB extends DBSchema {
  items: { key: string; value: SavedItem };
  screenshots: { key: string; value: Blob };
  collections: { key: string; value: Collection };
  practice: { key: string; value: PracticeEvent; indexes: { byItem: string } };
  progress: { key: string; value: MemorizationProgress };
  journal: { key: string; value: JournalEntry };
  meta: { key: string; value: unknown };
}

const DB_NAME = "duavault";

/** Fills fields added after an item was first stored. */
function withDefaults(item: SavedItem): SavedItem {
  return { ...item, reminderTime: item.reminderTime ?? null };
}
const DB_VERSION = 1;

/** On-device storage. Nothing leaves the browser. */
export class IndexedDbRepository implements Repository<Blob> {
  readonly mode = "local" as const;
  private dbPromise: Promise<IDBPDatabase<DuaVaultDB>> | null = null;
  private objectUrls = new Map<string, string>();

  constructor(private readonly dbName = DB_NAME) {}

  private db() {
    this.dbPromise ??= openDB<DuaVaultDB>(this.dbName, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("items", { keyPath: "id" });
        db.createObjectStore("screenshots");
        db.createObjectStore("collections", { keyPath: "id" });
        const practice = db.createObjectStore("practice", { keyPath: "id" });
        practice.createIndex("byItem", "itemId");
        db.createObjectStore("progress", { keyPath: "itemId" });
        db.createObjectStore("journal", { keyPath: "id" });
        db.createObjectStore("meta");
      },
    });
    return this.dbPromise;
  }

  private changed<T>(value: T): T {
    emitDataChange();
    return value;
  }

  async listItems(): Promise<SavedItem[]> {
    const items = await (await this.db()).getAll("items");
    return items.map(withDefaults).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getItem(id: string): Promise<SavedItem | null> {
    const item = await (await this.db()).get("items", id);
    return item ? withDefaults(item) : null;
  }

  async createItem(input: NewSavedItem, screenshot?: Blob | null): Promise<SavedItem> {
    const db = await this.db();
    const now = new Date().toISOString();
    const id = newId();
    let screenshotKey = input.screenshotKey;
    const tx = db.transaction(["items", "screenshots"], "readwrite");
    if (screenshot) {
      screenshotKey = `local/${id}`;
      await tx.objectStore("screenshots").put(screenshot, screenshotKey);
    }
    const item: SavedItem = {
      ...input,
      screenshotKey,
      id,
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: null,
      practiceCount: 0,
    };
    await tx.objectStore("items").put(item);
    await tx.done;
    return this.changed(item);
  }

  async updateItem(id: string, patch: ItemPatch): Promise<SavedItem> {
    const db = await this.db();
    const existing = await db.get("items", id);
    if (!existing) throw new Error("Item not found");
    const updated: SavedItem = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    await db.put("items", updated);
    return this.changed(updated);
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.db();
    const item = await db.get("items", id);
    const tx = db.transaction(["items", "screenshots", "collections", "progress", "practice"], "readwrite");
    await tx.objectStore("items").delete(id);
    if (item?.screenshotKey) await tx.objectStore("screenshots").delete(item.screenshotKey);
    await tx.objectStore("progress").delete(id);
    for (const c of await tx.objectStore("collections").getAll()) {
      if (c.itemIds.includes(id)) {
        await tx.objectStore("collections").put({ ...c, itemIds: c.itemIds.filter((x) => x !== id) });
      }
    }
    const practiceKeys = await tx.objectStore("practice").index("byItem").getAllKeys(id);
    for (const k of practiceKeys) await tx.objectStore("practice").delete(k);
    await tx.done;
    this.changed(undefined);
  }

  async getScreenshotUrl(key: string): Promise<string | null> {
    const cached = this.objectUrls.get(key);
    if (cached) return cached;
    const blob = await (await this.db()).get("screenshots", key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(key, url);
    return url;
  }

  async listCollections(): Promise<Collection[]> {
    const all = await (await this.db()).getAll("collections");
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCollection(name: string, description = ""): Promise<Collection> {
    const now = new Date().toISOString();
    const c: Collection = { id: newId(), name: name.trim(), description: description.trim(), itemIds: [], createdAt: now, updatedAt: now };
    await (await this.db()).put("collections", c);
    return this.changed(c);
  }

  async updateCollection(id: string, patch: { name?: string; description?: string }): Promise<Collection> {
    const db = await this.db();
    const c = await db.get("collections", id);
    if (!c) throw new Error("Collection not found");
    const updated = { ...c, ...patch, updatedAt: new Date().toISOString() };
    await db.put("collections", updated);
    return this.changed(updated);
  }

  async deleteCollection(id: string): Promise<void> {
    await (await this.db()).delete("collections", id);
    this.changed(undefined);
  }

  async setCollectionMembership(collectionId: string, itemId: string, member: boolean): Promise<void> {
    const db = await this.db();
    const c = await db.get("collections", collectionId);
    if (!c) throw new Error("Collection not found");
    const itemIds = member ? [...new Set([...c.itemIds, itemId])] : c.itemIds.filter((x) => x !== itemId);
    await db.put("collections", { ...c, itemIds, updatedAt: new Date().toISOString() });
    this.changed(undefined);
  }

  async recordPractice(itemId: string, kind: PracticeKind, rating?: MemorizationState): Promise<void> {
    const db = await this.db();
    const at = new Date().toISOString();
    const tx = db.transaction(["practice", "items"], "readwrite");
    await tx.objectStore("practice").put({ id: newId(), itemId, kind, at, rating });
    const item = await tx.objectStore("items").get(itemId);
    if (item) {
      await tx.objectStore("items").put({
        ...item,
        lastReviewedAt: at,
        practiceCount: item.practiceCount + (kind === "viewed" ? 0 : 1),
      });
    }
    await tx.done;
    this.changed(undefined);
  }

  async listPractice(): Promise<PracticeEvent[]> {
    const all = await (await this.db()).getAll("practice");
    return all.sort((a, b) => b.at.localeCompare(a.at));
  }

  async listProgress(): Promise<MemorizationProgress[]> {
    return (await this.db()).getAll("progress");
  }

  async saveProgress(progress: MemorizationProgress): Promise<void> {
    await (await this.db()).put("progress", progress);
    this.changed(undefined);
  }

  async removeProgress(itemId: string): Promise<void> {
    await (await this.db()).delete("progress", itemId);
    this.changed(undefined);
  }

  async listJournal(): Promise<JournalEntry[]> {
    const all = await (await this.db()).getAll("journal");
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getJournal(id: string): Promise<JournalEntry | null> {
    return (await (await this.db()).get("journal", id)) ?? null;
  }

  async saveJournal(entry: Omit<JournalEntry, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<JournalEntry> {
    const db = await this.db();
    const now = new Date().toISOString();
    const existing = entry.id ? await db.get("journal", entry.id) : undefined;
    const saved: JournalEntry = {
      ...entry,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.put("journal", saved);
    return this.changed(saved);
  }

  async deleteJournal(id: string): Promise<void> {
    await (await this.db()).delete("journal", id);
    this.changed(undefined);
  }

  async getReminderPreferences(): Promise<ReminderPreferences> {
    const prefs = (await (await this.db()).get("meta", "reminders")) as ReminderPreferences | undefined;
    return { ...DEFAULT_REMINDER_PREFERENCES, ...prefs };
  }

  async saveReminderPreferences(prefs: ReminderPreferences): Promise<void> {
    await (await this.db()).put("meta", prefs, "reminders");
    this.changed(undefined);
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
    const db = await this.db();
    const stores = ["items", "screenshots", "collections", "practice", "progress", "journal", "meta"] as const;
    const tx = db.transaction([...stores], "readwrite");
    for (const s of stores) await tx.objectStore(s).clear();
    await tx.done;
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.changed(undefined);
  }
}
