"use client";

import { useCallback, useEffect, useState } from "react";
import type { Repository } from "@/core/data/repository";
import { getRepository } from "./repository";
import { onDataChange } from "./events";

export interface LiveQuery<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Runs a repository query and re-runs it whenever data changes anywhere in the app. */
export function useLiveQuery<T>(query: (repo: Repository<Blob>) => Promise<T>, deps: unknown[] = []): LiveQuery<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const depsKey = JSON.stringify(deps);

  useEffect(() => onDataChange(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    query(getRepository())
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState((s) => ({ ...s, error: error instanceof Error ? error : new Error(String(error)), loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
    // `query` is recreated every render; re-run only when data or the caller's deps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, depsKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

export const useItems = () => useLiveQuery((r) => r.listItems());
export const useItem = (id: string) => useLiveQuery((r) => r.getItem(id), [id]);
export const useCollections = () => useLiveQuery((r) => r.listCollections());
export const useProgress = () => useLiveQuery((r) => r.listProgress());
export const usePractice = () => useLiveQuery((r) => r.listPractice());
export const useJournal = () => useLiveQuery((r) => r.listJournal());

export function useScreenshotUrl(key: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getRepository()
      .getScreenshotUrl(key)
      .then((url) => !cancelled && setResolved({ key, url }))
      .catch(() => !cancelled && setResolved({ key, url: null }));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return key && resolved?.key === key ? resolved.url : null;
}
