import assert from "node:assert/strict";
import test from "node:test";
import {
  getRemainingThrottleAttempts,
  getThrottleRetryAfterSeconds,
  recordThrottleAttempt,
  type LoginThrottlePolicy,
} from "../src/modules/auth/login-throttle.policy.js";

const policy: LoginThrottlePolicy = {
  maxAttempts: 2,
  observationWindowMs: 10_000,
  baseLockMs: 1_000,
  maxLockMs: 8_000,
  retentionMs: 60_000,
};

test("blocks after the configured threshold and resets the failure batch", () => {
  const firstAttemptAt = new Date("2026-05-31T20:00:00.000Z");
  const firstFailure = recordThrottleAttempt(null, policy, firstAttemptAt);

  assert.equal(firstFailure.attemptCount, 1);
  assert.equal(getRemainingThrottleAttempts(firstFailure, policy, firstAttemptAt), 1);

  const blockedAt = new Date(firstAttemptAt.getTime() + 100);
  const blockedState = recordThrottleAttempt(firstFailure, policy, blockedAt);

  assert.equal(blockedState.attemptCount, 0);
  assert.equal(blockedState.lockLevel, 1);
  assert.equal(getThrottleRetryAfterSeconds(blockedState, blockedAt), 1);
  assert.equal(getRemainingThrottleAttempts(blockedState, policy, blockedAt), 0);
});

test("increases lock duration after repeated failure batches", () => {
  const startedAt = new Date("2026-05-31T20:00:00.000Z");
  const firstFailure = recordThrottleAttempt(null, policy, startedAt);
  const firstLock = recordThrottleAttempt(firstFailure, policy, new Date(startedAt.getTime() + 100));
  const afterFirstLock = new Date(startedAt.getTime() + 1_101);
  const secondFailure = recordThrottleAttempt(firstLock, policy, afterFirstLock);
  const secondLockAt = new Date(afterFirstLock.getTime() + 100);
  const secondLock = recordThrottleAttempt(secondFailure, policy, secondLockAt);

  assert.equal(secondLock.lockLevel, 2);
  assert.equal(getThrottleRetryAfterSeconds(secondLock, secondLockAt), 2);
});

test("does not extend an active lock when another blocked request arrives", () => {
  const startedAt = new Date("2026-05-31T20:00:00.000Z");
  const firstFailure = recordThrottleAttempt(null, policy, startedAt);
  const blockedState = recordThrottleAttempt(firstFailure, policy, new Date(startedAt.getTime() + 100));
  const repeatedRequest = recordThrottleAttempt(blockedState, policy, new Date(startedAt.getTime() + 200));

  assert.deepEqual(repeatedRequest, blockedState);
});

test("starts a fresh failure batch after the observation window", () => {
  const startedAt = new Date("2026-05-31T20:00:00.000Z");
  const firstFailure = recordThrottleAttempt(null, policy, startedAt);
  const afterWindow = new Date(startedAt.getTime() + policy.observationWindowMs + 1);
  const freshFailure = recordThrottleAttempt(firstFailure, policy, afterWindow);

  assert.equal(freshFailure.attemptCount, 1);
  assert.equal(freshFailure.windowStartedAt, afterWindow);
});
