"use client";

import type { Repository } from "@/core/data/repository";
import { config } from "@/lib/config";
import { IndexedDbRepository } from "./indexeddb-repository";
import { SupabaseRepository } from "./supabase-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let repo: Repository<Blob> | null = null;

export function getRepository(): Repository<Blob> {
  repo ??= config.dataMode === "supabase" ? new SupabaseRepository(getSupabaseBrowserClient()) : new IndexedDbRepository();
  return repo;
}
