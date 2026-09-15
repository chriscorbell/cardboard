import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limitedDuring, limitedNow, otherProvider, providerAfterFailure, providerForDispatch } from "../src/services/fallback.js";
import type { LimitSnapshot } from "../src/services/provider-limits.js";

const NOW = Date.parse("2026-09-15T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const NOTHING: LimitSnapshot = { claude: null, codex: null };

/** A provider that refused `agoMs` ago and reopens `reopensInMs` from now, or never said. */
function refused(agoMs: number, reopensInMs: number | null) {
  return { at: iso(-agoMs), until: reopensInMs === null ? null : iso(reopensInMs) };
}

describe("the other provider", () => {
  it("is the one it is not", () => {
    assert.equal(otherProvider("claude"), "codex");
    assert.equal(otherProvider("codex"), "claude");
  });
});

describe("whether a provider is out of usage right now", () => {
  it("is true only while the window the provider named is still ahead", () => {
    assert.equal(limitedNow(refused(60_000, 600_000), NOW), true);
    assert.equal(limitedNow(refused(600_000, -60_000), NOW), false, "the window reopened");
  });

  it("is false when the provider named no window, however recent the refusal", () => {
    assert.equal(limitedNow(refused(1_000, null), NOW), false);
  });

  it("is false when nothing has been seen, or the time makes no sense", () => {
    assert.equal(limitedNow(null, NOW), false);
    assert.equal(limitedNow({ at: iso(0), until: "not a time" }, NOW), false);
  });
});

describe("whether a provider refused while a session was running", () => {
  it("is true for a refusal at or after the session began", () => {
    assert.equal(limitedDuring(refused(60_000, null), iso(-120_000)), true);
    assert.equal(limitedDuring(refused(120_000, null), iso(-120_000)), true, "the same instant counts");
  });

  it("is false for a refusal from before the session began", () => {
    assert.equal(limitedDuring(refused(300_000, null), iso(-120_000)), false);
  });

  it("is false with nothing seen or no start time", () => {
    assert.equal(limitedDuring(null, iso(-120_000)), false);
    assert.equal(limitedDuring(refused(60_000, null), null), false);
  });
});

describe("choosing a provider to start on", () => {
  it("uses the board's provider when nothing is known", () => {
    assert.deepEqual(providerForDispatch({ enabled: true, preferred: "claude", limits: NOTHING, nowMs: NOW }), { provider: "claude", switched: false });
  });

  it("routes around a provider whose window is still shut", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: null };
    assert.deepEqual(providerForDispatch({ enabled: true, preferred: "claude", limits, nowMs: NOW }), { provider: "codex", switched: true });
  });

  it("stays on the board's provider once its window has reopened", () => {
    const limits: LimitSnapshot = { claude: refused(3_600_000, -60_000), codex: null };
    assert.deepEqual(providerForDispatch({ enabled: true, preferred: "claude", limits, nowMs: NOW }), { provider: "claude", switched: false });
  });

  it("does not route around a refusal that named no window, since it may have reopened at once", () => {
    const limits: LimitSnapshot = { claude: refused(1_000, null), codex: null };
    assert.deepEqual(providerForDispatch({ enabled: true, preferred: "claude", limits, nowMs: NOW }), { provider: "claude", switched: false });
  });

  it("stays put when both providers are out, rather than swapping one dead end for another", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: refused(60_000, 600_000) };
    assert.deepEqual(providerForDispatch({ enabled: true, preferred: "claude", limits, nowMs: NOW }), { provider: "claude", switched: false });
  });

  it("does nothing at all when the Admin has turned fallback off", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: null };
    assert.deepEqual(providerForDispatch({ enabled: false, preferred: "claude", limits, nowMs: NOW }), { provider: "claude", switched: false });
  });
});

describe("choosing a provider after a session ended", () => {
  const base = { enabled: true, status: "failed", provider: "claude", fallbackFrom: null, since: iso(-300_000), nowMs: NOW } as const;

  it("moves to the other provider when this one refused the session for want of usage", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: null };
    assert.equal(providerAfterFailure({ ...base, limits }), "codex");
  });

  it("moves even when the provider named no window, because the session did fail", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, null), codex: null };
    assert.equal(providerAfterFailure({ ...base, limits }), "codex");
  });

  it("leaves a session that succeeded, was cancelled, or timed out alone", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: null };
    for (const status of ["succeeded", "cancelled", "timed_out", "running"] as const) {
      assert.equal(providerAfterFailure({ ...base, status, limits }), null, status);
    }
  });

  it("leaves a failure with no refusal behind it alone: fallback is not a general retry", () => {
    assert.equal(providerAfterFailure({ ...base, limits: NOTHING }), null);
  });

  it("ignores a refusal from before the session started, which was some other session's outage", () => {
    const limits: LimitSnapshot = { claude: refused(900_000, 600_000), codex: null };
    assert.equal(providerAfterFailure({ ...base, limits }), null);
  });

  it("falls back once and not again, so two exhausted providers cannot ping-pong a card", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: null };
    assert.equal(providerAfterFailure({ ...base, fallbackFrom: "codex", limits }), null);
  });

  it("stays ended when the other provider is out of usage too", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: refused(60_000, 600_000) };
    assert.equal(providerAfterFailure({ ...base, limits }), null);
  });

  it("does nothing when the Admin has turned fallback off", () => {
    const limits: LimitSnapshot = { claude: refused(60_000, 600_000), codex: null };
    assert.equal(providerAfterFailure({ ...base, enabled: false, limits }), null);
  });

  it("works in the other direction too", () => {
    const limits: LimitSnapshot = { claude: null, codex: refused(60_000, 600_000) };
    assert.equal(providerAfterFailure({ ...base, provider: "codex", limits }), "claude");
  });
});
