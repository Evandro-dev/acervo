import type { UserAccount } from "@/types/acervo";

export const AUTH_TOKEN_STORAGE_KEY = "acervo:token";
export const AUTH_USER_STORAGE_KEY = "acervo:user";
export const AUTH_CLEARED_EVENT = "acervo:auth-cleared";

export function readStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function readStoredUser() {
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserAccount;
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

export function writeStoredSession(token: string, user: UserAccount) {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
}
