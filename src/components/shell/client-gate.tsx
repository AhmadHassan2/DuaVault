"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True only in the browser after hydration. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * App pages read on-device data (IndexedDB) and the current time, so they
 * render in the browser only. The server sends the shell plus this fallback.
 */
export function ClientGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const hydrated = useHydrated();
  return hydrated ? <>{children}</> : <>{fallback ?? <PageSkeleton />}</>;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="paper-card h-64 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="paper-card h-36 animate-pulse" />
        <div className="paper-card h-36 animate-pulse" />
        <div className="paper-card h-36 animate-pulse" />
      </div>
    </div>
  );
}
