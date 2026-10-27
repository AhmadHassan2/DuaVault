/** Tiny change bus so UI hooks re-query after any repository mutation. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onDataChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataChange(): void {
  for (const l of listeners) l();
}
