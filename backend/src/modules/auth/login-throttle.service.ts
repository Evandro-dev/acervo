import { prisma } from "../../lib/prisma.js";
import { abbreviateAuthFingerprint, createAuthFingerprint } from "./auth-fingerprint.js";
import { getLoginThrottleSubjects } from "./login-throttle-identifiers.js";
import {
  getRemainingThrottleAttempts,
  getThrottleRetryAfterSeconds,
  LOGIN_THROTTLE_POLICIES,
  recordThrottleAttempt,
  type LoginThrottleScope,
  type LoginThrottleState,
} from "./login-throttle.policy.js";

type ThrottleTarget = {
  key: string;
  scope: LoginThrottleScope;
};

type StoredThrottle = LoginThrottleState & ThrottleTarget;

const THROTTLE_CLEANUP_INTERVAL_MS = 5 * 60_000;
let nextThrottleCleanupAt = 0;

function getThrottleTargets(email: string, ip: string): ThrottleTarget[] {
  const subjects = getLoginThrottleSubjects(email, ip);

  return [
    {
      key: createAuthFingerprint("login-account", subjects.account),
      scope: "ACCOUNT",
    },
    {
      key: createAuthFingerprint("login-ip", subjects.ip),
      scope: "IP",
    },
  ];
}

function summarizeThrottleStates(states: StoredThrottle[], now: Date) {
  const activeStates = states
    .map((state) => ({ ...state, retryAfterSeconds: getThrottleRetryAfterSeconds(state, now) }))
    .filter((state) => state.retryAfterSeconds > 0)
    .sort((left, right) => right.retryAfterSeconds - left.retryAfterSeconds);
  const strongestBlock = activeStates[0];

  return {
    blocked: Boolean(strongestBlock),
    retryAfterSeconds: strongestBlock?.retryAfterSeconds ?? 0,
    scope: strongestBlock?.scope,
    remainingAttempts: Math.min(
      ...states.map((state) =>
        getRemainingThrottleAttempts(state, LOGIN_THROTTLE_POLICIES[state.scope], now),
      ),
    ),
  };
}

async function lockThrottleTarget(transaction: typeof prisma, key: string) {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`login-throttle:${key}`}))::text`;
}

async function deleteExpiredLoginThrottles(now: Date) {
  if (now.getTime() < nextThrottleCleanupAt) return;

  nextThrottleCleanupAt = now.getTime() + THROTTLE_CLEANUP_INTERVAL_MS;

  try {
    await prisma.loginThrottle.deleteMany({ where: { expiresAt: { lte: now } } });
  } catch (error) {
    nextThrottleCleanupAt = 0;
    throw error;
  }
}

export function getLoginAuditContext(email: string, ip: string) {
  const [accountTarget, ipTarget] = getThrottleTargets(email, ip);

  return {
    accountFingerprint: abbreviateAuthFingerprint(accountTarget.key),
    ipFingerprint: abbreviateAuthFingerprint(ipTarget.key),
  };
}

export async function reserveLoginAttempt(email: string, ip: string) {
  const now = new Date();
  const targets = getThrottleTargets(email, ip).sort((left, right) => left.key.localeCompare(right.key));
  await deleteExpiredLoginThrottles(now);

  const storedStates = (await prisma.$transaction(async (transaction: typeof prisma) => {
    for (const target of targets) {
      await lockThrottleTarget(transaction, target.key);
    }

    const currentStates = (await transaction.loginThrottle.findMany({
      where: { key: { in: targets.map((target) => target.key) } },
    })) as StoredThrottle[];
    const statesByKey = new Map(currentStates.map((state) => [state.key, state]));
    const blockedStates = currentStates.filter((state) => getThrottleRetryAfterSeconds(state, now) > 0);

    if (blockedStates.length > 0) return { accepted: false, states: currentStates };

    const nextStates: StoredThrottle[] = [];
    for (const target of targets) {
      const currentState = statesByKey.get(target.key);
      const nextState = recordThrottleAttempt(currentState, LOGIN_THROTTLE_POLICIES[target.scope], now);
      const storedState = (await transaction.loginThrottle.upsert({
        where: { key: target.key },
        update: nextState,
        create: {
          key: target.key,
          scope: target.scope,
          ...nextState,
        },
      })) as StoredThrottle;

      nextStates.push(storedState);
    }

    return { accepted: true, states: nextStates };
  })) as { accepted: boolean; states: StoredThrottle[] };

  return {
    accepted: storedStates.accepted,
    ...summarizeThrottleStates(storedStates.states, now),
  };
}

export async function clearAccountLoginFailures(email: string) {
  await prisma.$transaction(async (transaction: typeof prisma) => {
    await clearAccountLoginFailuresForEmails(transaction, [email]);
  });
}

export async function clearAccountLoginFailuresForEmails(transaction: typeof prisma, emails: string[]) {
  const targets = [
    ...new Map(
      emails.map((email) => {
        const [accountTarget] = getThrottleTargets(email, "__unused__");
        return [accountTarget.key, accountTarget];
      }),
    ).values(),
  ].sort((left, right) => left.key.localeCompare(right.key));

  for (const accountTarget of targets) {
    await lockThrottleTarget(transaction, accountTarget.key);
  }

  await transaction.loginThrottle.deleteMany({ where: { key: { in: targets.map((target) => target.key) } } });
}
