const durationPattern = /^(\d+)(ms|s|m|h|d)$/i;

const unitMilliseconds = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 60 * 60_000,
  d: 24 * 60 * 60_000,
} as const;

export function parseDurationMs(value: string) {
  const match = durationPattern.exec(value.trim());
  if (!match) {
    throw new Error(`Duração inválida: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase() as keyof typeof unitMilliseconds;
  const durationMs = amount * unitMilliseconds[unit];

  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new Error(`Duração inválida: ${value}`);
  }

  return durationMs;
}

export function isSupportedDuration(value: string) {
  try {
    parseDurationMs(value);
    return true;
  } catch {
    return false;
  }
}
