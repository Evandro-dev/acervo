type HeaderCollection = {
  get?: (name: string) => unknown;
  Authorization?: unknown;
  authorization?: unknown;
};

function getAuthorizationHeader(headers?: HeaderCollection) {
  if (!headers) return undefined;

  const value =
    typeof headers.get === "function"
      ? headers.get("Authorization")
      : headers.Authorization ?? headers.authorization;

  return typeof value === "string" ? value : undefined;
}

export function hasAuthorizationHeader(headers?: HeaderCollection) {
  return Boolean(getAuthorizationHeader(headers));
}

export function getBearerTokenFromHeaders(headers?: HeaderCollection) {
  const authorization = getAuthorizationHeader(headers);
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function shouldClearStoredSessionAfterUnauthorized(input: {
  requestToken?: string;
  storedToken: string | null;
}) {
  return Boolean(input.requestToken && input.requestToken === input.storedToken);
}
