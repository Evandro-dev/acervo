import {
  getBearerTokenFromHeaders,
  hasAuthorizationHeader,
  shouldClearStoredSessionAfterUnauthorized,
} from "@/features/auth/auth-http";

describe("auth HTTP helpers", () => {
  it("keeps an explicit authorization header for logout requests", () => {
    const headers = { Authorization: "Bearer previous-session-token" };

    expect(hasAuthorizationHeader(headers)).toBe(true);
    expect(getBearerTokenFromHeaders(headers)).toBe("previous-session-token");
  });

  it("reads authorization from Axios-style header collections", () => {
    const headers = {
      get: (name: string) => (name === "Authorization" ? "Bearer axios-session-token" : undefined),
    };

    expect(hasAuthorizationHeader(headers)).toBe(true);
    expect(getBearerTokenFromHeaders(headers)).toBe("axios-session-token");
  });

  it("does not clear a newer session when an old request receives 401", () => {
    expect(
      shouldClearStoredSessionAfterUnauthorized({
        requestToken: "previous-session-token",
        storedToken: "new-session-token",
      }),
    ).toBe(false);
  });

  it("clears the current session when its own request receives 401", () => {
    expect(
      shouldClearStoredSessionAfterUnauthorized({
        requestToken: "current-session-token",
        storedToken: "current-session-token",
      }),
    ).toBe(true);
  });
});
