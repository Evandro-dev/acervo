import axios, { type AxiosRequestConfig } from "axios";
import {
  getBearerTokenFromHeaders,
  hasAuthorizationHeader,
  shouldClearStoredSessionAfterUnauthorized,
} from "@/features/auth/auth-http";
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearStoredSession,
} from "@/features/auth/storage";
import {
  getApiValidationMessage,
  type ApiValidationErrorData,
} from "@/lib/api-error-messages";

const fallbackBaseURL = "http://localhost:10000";
const configuredBaseURL = import.meta.env.VITE_API_URL?.trim();

export const apiBaseURL = configuredBaseURL || fallbackBaseURL;
export const isApiConfigured = Boolean(configuredBaseURL);

export const api = axios.create({
  baseURL: apiBaseURL,
});

type RequestConfigForAuthHeader = Pick<
  AxiosRequestConfig,
  "method" | "params" | "url"
>;

type ApiErrorData = ApiValidationErrorData & {
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
  blockedUntil?: string;
};

const pathsThatAlwaysRequireAuth = new Set([
  "/auth/logout",
  "/auth/me",
  "/events/dashboard-summary",
]);

const pathsThatNeverRequireAuth = new Set(["/auth/login", "/auth/register"]);

const protectedPathPrefixes = ["/reports", "/users"];

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getStoredAuthToken() {
  if (!canUseLocalStorage()) return null;

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function normalizeRequestMethod(method: string | undefined) {
  return (method ?? "get").toUpperCase();
}

function getRequestUrl(url: string | undefined) {
  const requestUrl = url || "/";

  try {
    return new URL(requestUrl, apiBaseURL);
  } catch {
    return new URL(
      requestUrl.startsWith("/") ? requestUrl : `/${requestUrl}`,
      apiBaseURL,
    );
  }
}

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: unknown,
) {
  if (value === null || value === undefined || value === "") return;

  if (Array.isArray(value)) {
    value.forEach((item) => appendSearchParam(searchParams, key, item));
    return;
  }

  searchParams.append(key, String(value));
}

function appendConfigParams(searchParams: URLSearchParams, params: unknown) {
  if (!params) return;

  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => searchParams.append(key, value));
    return;
  }

  if (Array.isArray(params)) {
    params.forEach((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        appendSearchParam(searchParams, String(entry[0]), entry[1]);
      }
    });
    return;
  }

  if (typeof params === "object") {
    Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
      appendSearchParam(searchParams, key, value);
    });
  }
}

function getRequestTarget(config: RequestConfigForAuthHeader) {
  const url = getRequestUrl(config.url);
  const searchParams = new URLSearchParams(url.search);

  appendConfigParams(searchParams, config.params);

  return {
    pathname: url.pathname,
    searchParams,
  };
}

function hasProtectedPathPrefix(pathname: string) {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSingleEventResource(pathname: string) {
  return /^\/events\/[^/]+$/.test(pathname);
}

export function shouldAttachAuthorizationHeader(
  config: RequestConfigForAuthHeader,
) {
  const method = normalizeRequestMethod(config.method);
  const { pathname, searchParams } = getRequestTarget(config);

  if (pathsThatNeverRequireAuth.has(pathname)) return false;

  if (
    pathsThatAlwaysRequireAuth.has(pathname) ||
    hasProtectedPathPrefix(pathname)
  ) {
    return true;
  }

  if (method !== "GET" && method !== "HEAD") return true;

  if (pathname === "/events" || isSingleEventResource(pathname)) {
    return searchParams.get("includeArticles") === "all";
  }

  if (pathname === "/articles") {
    const status = searchParams.get("status");
    return Boolean(status && status !== "published");
  }

  return false;
}

function getHeaderValue(headers: unknown, name: string) {
  if (!headers || typeof headers !== "object") return undefined;

  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(name);
  }

  const lowerName = name.toLowerCase();
  const record = headers as Record<string, unknown>;

  return (
    record[name] ??
    record[lowerName] ??
    Object.entries(record).find(([key]) => key.toLowerCase() === lowerName)?.[1]
  );
}

function getRetryAfterHeaderValue(headers: unknown) {
  return getHeaderValue(headers, "retry-after");
}

function getUnauthorizedSessionNotice(data: ApiErrorData | undefined) {
  if (
    data?.code === "SESSION_REVOKED" ||
    data?.code === "SESSION_EXPIRED" ||
    data?.code === "ACCOUNT_DISABLED"
  ) {
    return typeof data.error === "string" ? data.error : undefined;
  }

  return undefined;
}

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();

  if (
    token &&
    shouldAttachAuthorizationHeader(config) &&
    !hasAuthorizationHeader(config.headers)
  ) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    await normalizeApiBlobError(error);

    if (axios.isAxiosError(error)) {
      const isLoginRequest = error.config?.url === "/auth/login";
      const requestToken = getBearerTokenFromHeaders(error.config?.headers);
      const storedToken = getStoredAuthToken();
      const shouldClearSession = shouldClearStoredSessionAfterUnauthorized({
        requestToken,
        storedToken,
      });

      if (error.response?.status === 401 && !isLoginRequest && shouldClearSession) {
        clearStoredSession({
          notice: getUnauthorizedSessionNotice(getApiErrorData(error)),
        });
      }
    }

    return Promise.reject(error);
  },
);

export function getApiResourceUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/")) return trimmed;

  return `${apiBaseURL.replace(/\/$/, "")}${trimmed}`;
}

export async function normalizeApiBlobError(error: unknown) {
  if (!axios.isAxiosError(error)) return;

  const response = error.response;
  const data = response?.data;

  if (!response || typeof Blob === "undefined" || !(data instanceof Blob)) {
    return;
  }

  const contentType = getHeaderValue(response.headers, "content-type") ?? data.type;

  if (
    typeof contentType !== "string" ||
    !contentType.toLowerCase().includes("json")
  ) {
    return;
  }

  try {
    response.data = JSON.parse(await data.text());
  } catch {
    // Mantém o Blob original quando a resposta do servidor não for um JSON válido.
  }
}

function getApiErrorData(error: unknown): ApiErrorData | undefined {
  if (!axios.isAxiosError(error)) return undefined;

  const data = error.response?.data;

  return data && typeof data === "object" ? (data as ApiErrorData) : undefined;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir a operação.",
) {
  const data = getApiErrorData(error);

  if (data) {
    const validationMessage = getApiValidationMessage(data);
    if (validationMessage) return validationMessage;

    return (typeof data.error === "string" && data.error) || fallback;
  }

  if (axios.isAxiosError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}

export function getApiErrorCode(error: unknown) {
  const data = getApiErrorData(error);

  return typeof data?.code === "string" ? data.code : undefined;
}

export function getApiRetryAfterSeconds(error: unknown) {
  const data = getApiErrorData(error);

  if (typeof data?.retryAfterSeconds === "number") {
    return data.retryAfterSeconds;
  }

  if (!axios.isAxiosError(error)) return undefined;

  const headerValue = getRetryAfterHeaderValue(error.response?.headers);
  const seconds = Number(headerValue);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
