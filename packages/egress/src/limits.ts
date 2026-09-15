import type http from "node:http";

// A Provider's usage window belongs to the subscription, not to one Session: every concurrent Session
// and the Admin's own interactive use draw on the same window (ADR 0002). The proxy is the only part
// of the stack that sees the provider's own answer, so it is where a usage limit is observed. It
// keeps the last refusal per Provider in memory and the app reads it back from `/limits`.
//
// In memory on purpose: a usage window is minutes to hours long and a restarted proxy simply learns
// again from the next refusal. Nothing here is worth a database.

export type Provider = "claude" | "codex";

export interface UsageLimit {
  /** When the proxy saw the provider refuse a request for want of usage, ISO 8601. */
  at: string;
  /** When the provider said the window reopens, ISO 8601, or null when it did not say. */
  until: string | null;
}

export type LimitSnapshot = Record<Provider, UsageLimit | null>;

/** A refusal for want of usage. 429 is the only status either provider uses for one. */
export function isUsageLimit(status: number | undefined): boolean {
  return status === 429;
}

/** Longest window we will believe. A malformed header must not park a Provider for a year. */
const MAX_WINDOW_MS = 24 * 3_600_000;

function one(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return one(value[0]);
  return null;
}

function within(atMs: number, nowMs: number): string | null {
  if (!Number.isFinite(atMs)) return null;
  if (atMs <= nowMs || atMs > nowMs + MAX_WINDOW_MS) return null;
  return new Date(atMs).toISOString();
}

/**
 * When the provider said the window reopens. Two headers are read, both of which the providers send
 * on a 429: Anthropic's unified reset, which is unix seconds, and `retry-after` from RFC 9110, which
 * is either delta-seconds or an HTTP date. Anything else is treated as "it did not say".
 */
export function resetAt(headers: http.IncomingHttpHeaders, nowMs: number): string | null {
  const unified = one(headers["anthropic-ratelimit-unified-reset"]);
  if (unified && /^\d+$/.test(unified)) {
    const parsed = within(Number(unified) * 1000, nowMs);
    if (parsed) return parsed;
  }
  const retry = one(headers["retry-after"]);
  if (retry) {
    if (/^\d+$/.test(retry)) return within(nowMs + Number(retry) * 1000, nowMs);
    return within(Date.parse(retry), nowMs);
  }
  return null;
}

/** The last usage refusal seen per Provider. One instance per process; the proxy writes, /limits reads. */
export class UsageLimits {
  private seen = new Map<Provider, UsageLimit>();

  note(provider: Provider, headers: http.IncomingHttpHeaders, nowMs = Date.now()): UsageLimit {
    const limit: UsageLimit = { at: new Date(nowMs).toISOString(), until: resetAt(headers, nowMs) };
    this.seen.set(provider, limit);
    return limit;
  }

  snapshot(): LimitSnapshot {
    return { claude: this.seen.get("claude") ?? null, codex: this.seen.get("codex") ?? null };
  }
}
