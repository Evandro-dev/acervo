const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_EMAIL_LOGIN_ATTEMPTS = 5;
const MAX_IP_LOGIN_ATTEMPTS = 10;

type AttemptState = {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
};

type BlockScope = "email" | "ip";

const attempts = new Map<string, AttemptState>();

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized || "__empty__";
}

function getEmailKey(email: string, ip: string) {
  return `email::${ip}::${normalizeEmail(email)}`;
}

function getIpKey(ip: string) {
  return `ip::${ip}`;
}

function getFreshState(state?: AttemptState) {
  if (!state) return undefined;

  const now = Date.now();
  if (state.blockedUntil && state.blockedUntil > now) return state;
  if (now - state.firstAttemptAt <= LOGIN_WINDOW_MS) {
    return { ...state, blockedUntil: undefined };
  }

  return undefined;
}

function getRemainingAttempts(state: AttemptState | undefined, maxAttempts: number) {
  if (!state) return maxAttempts;
  if (state.blockedUntil && state.blockedUntil > Date.now()) return 0;
  return Math.max(0, maxAttempts - state.count);
}

function getBlockDetails(state: AttemptState | undefined, scope: BlockScope) {
  const now = Date.now();

  if (!state?.blockedUntil || state.blockedUntil <= now) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
      scope,
    };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000)),
    scope,
  };
}

function pickBlock(emailState: AttemptState | undefined, ipState: AttemptState | undefined) {
  const emailBlock = getBlockDetails(emailState, "email");
  const ipBlock = getBlockDetails(ipState, "ip");

  if (!emailBlock.blocked && !ipBlock.blocked) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
      scope: undefined,
    };
  }

  return emailBlock.retryAfterSeconds >= ipBlock.retryAfterSeconds ? emailBlock : ipBlock;
}

function recordScopeFailure(key: string, maxAttempts: number) {
  const now = Date.now();
  const current = getFreshState(attempts.get(key));

  if (!current) {
    const nextState: AttemptState = { count: 1, firstAttemptAt: now };
    attempts.set(key, nextState);
    return nextState;
  }

  const count = current.count + 1;
  const nextState: AttemptState = {
    count,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil: count >= maxAttempts ? now + LOGIN_WINDOW_MS : undefined,
  };

  attempts.set(key, nextState);
  return nextState;
}

export function getLoginBlock(email: string, ip: string) {
  const emailState = getFreshState(attempts.get(getEmailKey(email, ip)));
  const ipState = getFreshState(attempts.get(getIpKey(ip)));
  return pickBlock(emailState, ipState);
}

export function recordLoginFailure(email: string, ip: string) {
  const emailState = recordScopeFailure(getEmailKey(email, ip), MAX_EMAIL_LOGIN_ATTEMPTS);
  const ipState = recordScopeFailure(getIpKey(ip), MAX_IP_LOGIN_ATTEMPTS);
  const block = pickBlock(emailState, ipState);

  return {
    ...block,
    remainingAttempts: Math.max(
      0,
      Math.min(
        getRemainingAttempts(emailState, MAX_EMAIL_LOGIN_ATTEMPTS),
        getRemainingAttempts(ipState, MAX_IP_LOGIN_ATTEMPTS),
      ),
    ),
  };
}

export function clearLoginFailures(email: string, ip: string) {
  attempts.delete(getEmailKey(email, ip));
  attempts.delete(getIpKey(ip));
}
