import assert from "node:assert/strict";
import test from "node:test";
import {
  isAuthSessionExpired,
  shouldRefreshAuthSessionActivity,
} from "../src/modules/auth/auth-session.policy.js";

test("refreshes activity before the minimum supported idle timeout expires", () => {
  const lastSeenAt = new Date("2026-05-31T20:00:00.000Z");
  const now = new Date("2026-05-31T20:01:00.000Z");

  assert.equal(
    shouldRefreshAuthSessionActivity({
      now,
      lastSeenAt,
      refreshIntervalMs: 60_000,
    }),
    true,
  );
  assert.equal(
    isAuthSessionExpired({
      now,
      lastSeenAt,
      absoluteExpiresAt: new Date("2026-05-31T21:00:00.000Z"),
      idleTimeoutMs: 5 * 60_000,
    }),
    false,
  );
});

test("expires sessions at their idle or absolute limit", () => {
  const lastSeenAt = new Date("2026-05-31T20:00:00.000Z");

  assert.equal(
    isAuthSessionExpired({
      now: new Date("2026-05-31T20:05:00.000Z"),
      lastSeenAt,
      absoluteExpiresAt: new Date("2026-05-31T21:00:00.000Z"),
      idleTimeoutMs: 5 * 60_000,
    }),
    true,
  );
  assert.equal(
    isAuthSessionExpired({
      now: new Date("2026-05-31T20:01:00.000Z"),
      lastSeenAt,
      absoluteExpiresAt: new Date("2026-05-31T20:01:00.000Z"),
      idleTimeoutMs: 5 * 60_000,
    }),
    true,
  );
});
