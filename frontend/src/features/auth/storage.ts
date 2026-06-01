import type { UserAccount } from "@/types/acervo";

export const AUTH_TOKEN_STORAGE_KEY = "acervo:token";
export const AUTH_USER_STORAGE_KEY = "acervo:user";
export const AUTH_NOTICE_STORAGE_KEY = "acervo:auth-notice";
export const AUTH_CHANGED_EVENT = "acervo:auth-changed";
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
  const serializedUser = JSON.stringify(user);
  const tokenChanged = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) !== token;
  const userChanged = localStorage.getItem(AUTH_USER_STORAGE_KEY) !== serializedUser;

  if (tokenChanged) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  if (userChanged) localStorage.setItem(AUTH_USER_STORAGE_KEY, serializedUser);
  if (tokenChanged || userChanged) window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function clearStoredSession(options?: { notice?: string }) {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);

  if (options?.notice) {
    sessionStorage.setItem(AUTH_NOTICE_STORAGE_KEY, options.notice);
  }

  window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function readAndClearAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_NOTICE_STORAGE_KEY);
  return notice;
}

export function isAuthStorageKey(key: string | null) {
  return key === AUTH_TOKEN_STORAGE_KEY || key === AUTH_USER_STORAGE_KEY;
}
