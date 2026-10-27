import type {
  Collection,
  JournalEntry,
  MemorizationProgress,
  NewSavedItem,
  PracticeEvent,
  PracticeKind,
  MemorizationState,
  SavedItem,
} from "../types";

export type DataMode = "local" | "supabase";

export type ItemPatch = Partial<NewSavedItem>;

export interface ReminderPreferences {
  dailyReminderEnabled: boolean;
  /** "HH:MM" local time. */
  dailyReminderTime: string;
}

export interface ExportBundle {
  exportedAt: string;
  app: "DuaVault";
  items: SavedItem[];
  collections: Collection[];
  practice: PracticeEvent[];
  progress: MemorizationProgress[];
  journal: JournalEntry[];
}

/**
 * Storage abstraction. Implementations: IndexedDB (on-device) and Supabase.
 * `TFile` is the platform's binary type (Blob in browsers).
 */
export interface Repository<TFile = unknown> {
  readonly mode: DataMode;

  listItems(): Promise<SavedItem[]>;
  getItem(id: string): Promise<SavedItem | null>;
  createItem(input: NewSavedItem, screenshot?: TFile | null): Promise<SavedItem>;
  updateItem(id: string, patch: ItemPatch): Promise<SavedItem>;
  deleteItem(id: string): Promise<void>;
  /** A URL the UI can display (object URL or short-lived signed URL). */
  getScreenshotUrl(key: string): Promise<string | null>;

  listCollections(): Promise<Collection[]>;
  createCollection(name: string, description?: string): Promise<Collection>;
  updateCollection(id: string, patch: { name?: string; description?: string }): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;
  setCollectionMembership(collectionId: string, itemId: string, member: boolean): Promise<void>;

  /** Records an engagement event and updates the item's lastReviewedAt / practiceCount. */
  recordPractice(itemId: string, kind: PracticeKind, rating?: MemorizationState): Promise<void>;
  listPractice(): Promise<PracticeEvent[]>;

  listProgress(): Promise<MemorizationProgress[]>;
  saveProgress(progress: MemorizationProgress): Promise<void>;
  removeProgress(itemId: string): Promise<void>;

  listJournal(): Promise<JournalEntry[]>;
  getJournal(id: string): Promise<JournalEntry | null>;
  saveJournal(entry: Omit<JournalEntry, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<JournalEntry>;
  deleteJournal(id: string): Promise<void>;

  getReminderPreferences(): Promise<ReminderPreferences>;
  saveReminderPreferences(prefs: ReminderPreferences): Promise<void>;

  exportAll(): Promise<ExportBundle>;
  deleteAll(): Promise<void>;
}

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  dailyReminderEnabled: false,
  dailyReminderTime: "08:00",
};
