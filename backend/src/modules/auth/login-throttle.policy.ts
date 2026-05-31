export type LoginThrottleScope = "ACCOUNT" | "IP";

export type LoginThrottlePolicy = {
  maxAttempts: number;
  observationWindowMs: number;
  baseLockMs: number;
  maxLockMs: number;
  retentionMs: number;
};

export type LoginThrottleState = {
  attemptCount: number;
  lockLevel: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
  expiresAt: Date;
};

export const LOGIN_THROTTLE_POLICIES: Record<LoginThrottleScope, LoginThrottlePolicy> = {
  ACCOUNT: {
    maxAttempts: 5,
    observationWindowMs: 15 * 60_000,
    baseLockMs: 30_000,
    maxLockMs: 15 * 60_000,
    retentionMs: 24 * 60 * 60_000,
  },
  IP: {
    maxAttempts: 100,
    observationWindowMs: 15 * 60_000,
    baseLockMs: 60_000,
    maxLockMs: 30 * 60_000,
    retentionMs: 24 * 60 * 60_000,
  },
};

export function getActiveThrottleState(state: LoginThrottleState | null | undefined, now: Date) {
  if (!state || state.expiresAt.getTime() <= now.getTime()) return null;
  return state;
}

export function getThrottleRetryAfterSeconds(state: LoginThrottleState | null | undefined, now: Date) {
  const activeState = getActiveThrottleState(state, now);
  if (!activeState?.blockedUntil || activeState.blockedUntil.getTime() <= now.getTime()) return 0;

  return Math.max(1, Math.ceil((activeState.blockedUntil.getTime() - now.getTime()) / 1_000));
}

export function getRemainingThrottleAttempts(
  state: LoginThrottleState | null | undefined,
  policy: LoginThrottlePolicy,
  now: Date,
) {
  const activeState = getActiveThrottleState(state, now);
  if (!activeState) return policy.maxAttempts;
  if (getThrottleRetryAfterSeconds(activeState, now) > 0) return 0;

  const windowExpired =
    now.getTime() - activeState.windowStartedAt.getTime() > policy.observationWindowMs;

  return windowExpired ? policy.maxAttempts : Math.max(0, policy.maxAttempts - activeState.attemptCount);
}

export function recordThrottleAttempt(
  state: LoginThrottleState | null | undefined,
  policy: LoginThrottlePolicy,
  now: Date,
): LoginThrottleState {
  const activeState = getActiveThrottleState(state, now);

  // A request already rejected by the lock must not extend the lock indefinitely.
  if (activeState && getThrottleRetryAfterSeconds(activeState, now) > 0) {
    return activeState;
  }

  const hasActiveWindow =
    activeState &&
    now.getTime() - activeState.windowStartedAt.getTime() <= policy.observationWindowMs;
  const attemptCount = (hasActiveWindow ? activeState.attemptCount : 0) + 1;
  const lockLevel = activeState?.lockLevel ?? 0;
  const expiresAt = new Date(now.getTime() + policy.retentionMs);

  if (attemptCount < policy.maxAttempts) {
    return {
      attemptCount,
      lockLevel,
      windowStartedAt: hasActiveWindow ? activeState.windowStartedAt : now,
      blockedUntil: null,
      expiresAt,
    };
  }

  const nextLockLevel = lockLevel + 1;
  const lockDurationMs = Math.min(policy.baseLockMs * 2 ** (nextLockLevel - 1), policy.maxLockMs);

  return {
    attemptCount: 0,
    lockLevel: nextLockLevel,
    windowStartedAt: now,
    blockedUntil: new Date(now.getTime() + lockDurationMs),
    expiresAt,
  };
}
