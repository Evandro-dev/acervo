import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, AuthProvider } from "@/features/auth/auth-context";
import { fetchCurrentUser, logoutCurrentSession } from "@/features/auth/api";
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  clearStoredSession,
  readAndClearAuthNotice,
} from "@/features/auth/storage";

vi.mock("@/features/auth/api", () => ({
  fetchCurrentUser: vi.fn(),
  loginWithPassword: vi.fn(),
  logoutCurrentSession: vi.fn(),
}));

const mockedFetchCurrentUser = vi.mocked(fetchCurrentUser);
const mockedLogoutCurrentSession = vi.mocked(logoutCurrentSession);
const user = {
  id: "user-1",
  name: "Admin",
  email: "admin@acervo.edu",
  role: "ADMIN" as const,
  isActive: true,
};

function AuthProbe() {
  const { isLoading, logout, refresh, user: authenticatedUser } = useAuth();
  return (
    <>
      <button onClick={logout}>{authenticatedUser?.email ?? "anonymous"}</button>
      <button onClick={() => void refresh()}>refresh</button>
      <span>{isLoading ? "loading" : "ready"}</span>
    </>
  );
}

function renderProvider() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockedFetchCurrentUser.mockReset();
    mockedFetchCurrentUser.mockResolvedValue({ user });
    mockedLogoutCurrentSession.mockReset();
    mockedLogoutCurrentSession.mockResolvedValue(undefined);
  });

  it("synchronizes a session received from another browser tab", async () => {
    renderProvider();
    expect(screen.getByRole("button", { name: "anonymous" })).toBeInTheDocument();

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-from-another-tab");
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new StorageEvent("storage", { key: AUTH_TOKEN_STORAGE_KEY }));

    await screen.findByRole("button", { name: "admin@acervo.edu" });
    await waitFor(() => expect(mockedFetchCurrentUser).toHaveBeenCalled());
  });

  it("clears local state immediately and revokes the server session on logout", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "active-token");
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    renderProvider();

    fireEvent.click(await screen.findByRole("button", { name: "admin@acervo.edu" }));

    await screen.findByRole("button", { name: "anonymous" });
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(mockedLogoutCurrentSession).toHaveBeenCalledWith("active-token");
  });

  it("keeps a server-provided expiration notice for the login screen", () => {
    clearStoredSession({ notice: "Sua sessão expirou. Entre novamente." });
    expect(readAndClearAuthNotice()).toBe("Sua sessão expirou. Entre novamente.");
    expect(readAndClearAuthNotice()).toBeNull();
  });

  it("keeps the local session when a background refresh fails temporarily", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "active-token");
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    mockedFetchCurrentUser.mockRejectedValueOnce(new Error("temporary network failure"));

    renderProvider();

    await waitFor(() => expect(mockedFetchCurrentUser).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "admin@acervo.edu" })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("active-token");
  });

  it("does not keep an authenticated session alive with a polling interval", () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "active-token");
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    renderProvider();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("keeps the authenticated screen visible and coalesces concurrent background refreshes", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "active-token");
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    renderProvider();

    await waitFor(() => expect(mockedFetchCurrentUser).toHaveBeenCalledTimes(1));
    await screen.findByText("ready");

    let resolveRefresh: (value: { user: typeof user }) => void;
    mockedFetchCurrentUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => expect(mockedFetchCurrentUser).toHaveBeenCalledTimes(2));
    expect(screen.getByText("ready")).toBeInTheDocument();

    resolveRefresh!({ user });
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
  });
});
