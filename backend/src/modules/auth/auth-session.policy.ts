export function isAuthSessionExpired(input: {
  now: Date;
  lastSeenAt: Date;
  absoluteExpiresAt: Date;
  idleTimeoutMs: number;
}) {
  const idleExpiresAt = new Date(input.lastSeenAt.getTime() + input.idleTimeoutMs);
  return input.absoluteExpiresAt <= input.now || idleExpiresAt <= input.now;
}

export function shouldRefreshAuthSessionActivity(input: {
  now: Date;
  lastSeenAt: Date;
  refreshIntervalMs: number;
}) {
  return input.now.getTime() - input.lastSeenAt.getTime() >= input.refreshIntervalMs;
}
