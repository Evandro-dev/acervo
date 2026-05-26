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
  AUTH_CLEARED_EVENT,
  clearStoredSession,
  readStoredToken,
  readStoredUser,
  writeStoredSession,
} from "./storage";
import { fetchCurrentUser, loginWithPassword } from "./api";

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

  const logout = useCallback(() => {
    clearStoredSession();
    startTransition(() => {
      setToken(null);
      setUser(null);
      setIsLoading(false);
    });
    queryClient.invalidateQueries({ queryKey: ["acervo"] });
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
      writeStoredSession(storedToken, response.user);
      startTransition(() => {
        setToken(storedToken);
        setUser(response.user);
        setIsLoading(false);
      });
      return response.user;
    } catch {
      clearStoredSession();
      startTransition(() => {
        setToken(null);
        setUser(null);
        setIsLoading(false);
      });
      return null;
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
    if (!token) {
      setIsLoading(false);
      return;
    }

    refresh();
  }, [refresh, token]);

  useEffect(() => {
    const onAuthCleared = () => {
      startTransition(() => {
        setToken(null);
        setUser(null);
        setIsLoading(false);
      });
    };

    window.addEventListener(AUTH_CLEARED_EVENT, onAuthCleared);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, onAuthCleared);
  }, []);

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
