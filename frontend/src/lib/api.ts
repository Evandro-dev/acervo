import axios from "axios";
import {
  getBearerTokenFromHeaders,
  hasAuthorizationHeader,
  shouldClearStoredSessionAfterUnauthorized,
} from "@/features/auth/auth-http";
import { AUTH_TOKEN_STORAGE_KEY, clearStoredSession } from "@/features/auth/storage";
import { getApiValidationMessage, type ApiValidationErrorData } from "@/lib/api-error-messages";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:10000";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token && !hasAuthorizationHeader(config.headers)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    await normalizeApiBlobError(error);
    const isLoginRequest = error?.config?.url === "/auth/login";
    const requestToken = getBearerTokenFromHeaders(error?.config?.headers);
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const shouldClearSession = shouldClearStoredSessionAfterUnauthorized({ requestToken, storedToken });

    if (error?.response?.status === 401 && !isLoginRequest && shouldClearSession) {
      const code = error?.response?.data?.code;
      const notice =
        code === "SESSION_REVOKED" || code === "SESSION_EXPIRED"
          ? error.response.data.error
          : undefined;

      clearStoredSession({ notice });
    }

    return Promise.reject(error);
  },
);

export const isApiConfigured = Boolean(import.meta.env.VITE_API_URL);

export function getApiResourceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return trimmed;

  return `${baseURL.replace(/\/$/, "")}${trimmed}`;
}

type ApiErrorData = ApiValidationErrorData & {
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
  blockedUntil?: string;
};

function getHeaderValue(headers: unknown, name: string) {
  if (!headers || typeof headers !== "object") return undefined;
  if ("get" in headers && typeof headers.get === "function") return headers.get(name);
  return (headers as Record<string, unknown>)[name];
}

export async function normalizeApiBlobError(error: unknown) {
  if (!axios.isAxiosError(error)) return;

  const response = error.response;
  const data = response?.data;
  if (!response || typeof Blob === "undefined" || !(data instanceof Blob)) return;

  const contentType = getHeaderValue(response.headers, "content-type") ?? data.type;
  if (typeof contentType !== "string" || !contentType.toLowerCase().includes("json")) return;

  try {
    response.data = JSON.parse(await data.text());
  } catch {
    // Preserve the original Blob when the server response is not valid JSON.
  }
}

function getApiErrorData(error: unknown): ApiErrorData | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = error.response?.data;
  return data && typeof data === "object" ? (data as ApiErrorData) : undefined;
}

export function getApiErrorMessage(error: unknown, fallback = "Não foi possível concluir a operação.") {
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
  if (typeof data?.retryAfterSeconds === "number") return data.retryAfterSeconds;

  if (axios.isAxiosError(error)) {
    const headerValue = error.response?.headers?.["retry-after"];
    const seconds = Number(headerValue);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }

  return undefined;
}
