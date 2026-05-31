import axios from "axios";
import { AUTH_CLEARED_EVENT, AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "@/features/auth/storage";
import { getApiValidationMessage, type ApiValidationErrorData } from "@/lib/api-error-messages";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:10000";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
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
  remainingAttempts?: number;
  blockedUntil?: string;
};

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

export function getApiRemainingAttempts(error: unknown) {
  const data = getApiErrorData(error);
  return typeof data?.remainingAttempts === "number" ? data.remainingAttempts : undefined;
}
