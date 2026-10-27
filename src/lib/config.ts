import type { DataMode } from "@/core/data/repository";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const requestedMode = process.env.NEXT_PUBLIC_DATA_MODE;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * "supabase" only when explicitly requested AND configured; otherwise the app
 * runs entirely on-device with IndexedDB.
 */
export const dataMode: DataMode = requestedMode === "supabase" && supabaseConfigured ? "supabase" : "local";

export const config = {
  supabaseUrl,
  supabaseAnonKey,
  dataMode,
  /** True when supabase mode was requested but env vars are missing. */
  supabaseMisconfigured: requestedMode === "supabase" && !supabaseConfigured,
  /** Optional self-hosted Tesseract assets; defaults to the jsDelivr CDN. */
  tesseract: {
    langPath: process.env.NEXT_PUBLIC_TESSERACT_LANG_PATH || undefined,
    workerPath: process.env.NEXT_PUBLIC_TESSERACT_WORKER_PATH || undefined,
    corePath: process.env.NEXT_PUBLIC_TESSERACT_CORE_PATH || undefined,
  },
} as const;
