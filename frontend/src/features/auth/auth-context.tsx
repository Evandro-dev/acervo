import {
  useCallback,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LoginPayload, UserAccount } from "@/types/acervo";
import {
  AUTH_CHANGED_EVENT,
  AUTH_CLEARED_EVENT,
  clearStoredSession,
  isAuthStorageKey,
  readStoredToken,
  readStoredUser,
  writeStoredSession,
} from "./storage";
import { fetchCurrentUser, loginWithPassword, logoutCurrentSession } from "./api";

type AuthContextValue = {
  user: UserAccount | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<UserAccount>;
  logout: () => void;
  refresh: () => Promise<UserAccount | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<UserAccount | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState(Boolean(readStoredToken()));

  const applyStoredSession = useCallback(() => {
    const storedToken = readStoredToken();
    const storedUser = readStoredUser();

    startTransition(() => {
      setToken(storedToken);
      setUser(storedToken ? storedUser : null);
      if (!storedToken) setIsLoading(false);
    });
  }, []);

  const logout = useCallback(() => {
    const storedToken = readStoredToken();
    clearStoredSession();
    startTransition(() => {
      setToken(null);
      setUser(null);
      setIsLoading(false);
    });
    queryClient.invalidateQueries({ queryKey: ["acervo"] });

    if (storedToken) {
      void logoutCurrentSession(storedToken).catch(() => undefined);
    }
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const storedToken = readStoredToken();
    if (!storedToken) {
      startTransition(() => {
        setToken(null);
        setUser(null);
        setIsLoading(false);
      });
      return null;
    }

    setIsLoading(true);

    try {
      const response = await fetchCurrentUser();
      if (readStoredToken() !== storedToken) return readStoredUser();

      writeStoredSession(storedToken, response.user);
      startTransition(() => {
        setToken(storedToken);
        setUser(response.user);
        setIsLoading(false);
      });
      return response.user;
    } catch {
      if (readStoredToken() !== storedToken) return readStoredUser();

      const storedUser = readStoredUser();
      startTransition(() => {
        setToken(storedToken);
        setUser(storedUser);
        setIsLoading(false);
      });
      return storedUser;
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginWithPassword(payload);
    writeStoredSession(response.token, response.user);
    startTransition(() => {
      setToken(response.token);
      setUser(response.user);
      setIsLoading(false);
    });
    queryClient.invalidateQueries({ queryKey: ["acervo"] });
    return response.user;
  }, [queryClient]);

  useEffect(() => {
    if (!token) return;

    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refresh, token]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (isAuthStorageKey(event.key)) applyStoredSession();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, applyStoredSession);
    window.addEventListener(AUTH_CLEARED_EVENT, applyStoredSession);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, applyStoredSession);
      window.removeEventListener(AUTH_CLEARED_EVENT, applyStoredSession);
      window.removeEventListener("storage", onStorage);
    };
  }, [applyStoredSession]);

  useEffect(() => {
    if (!token) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      logout,
      refresh,
    }),
    [isLoading, login, logout, refresh, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
