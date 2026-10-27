import type { ClassifierStrategy } from "./classifier";

/**
 * Contract for an OPTIONAL classifier that runs outside the device (e.g. a
 * self-hosted or cloud model). None is shipped. Any implementation must:
 *
 * - be disabled by default and enabled only by an explicit user action;
 * - show exactly what text will be sent before sending it (never images by default);
 * - never be required for the app to work — the rule-based strategy stays the fallback;
 * - never be used as evidence of religious authenticity (verification only
 *   comes from trusted datasets).
 */
export interface ExternalClassifierAdapter extends ClassifierStrategy {
  readonly provider: string;
  readonly sendsDataOffDevice: true;
  /** Returns false when the user hasn't explicitly opted in. */
  isEnabled(): boolean;
}
