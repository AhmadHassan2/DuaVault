"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  client ??= createBrowserClient(config.supabaseUrl, config.supabaseAnonKey);
  return client;
}
