import axios from "axios";
import { AUTH_CLEARED_EVENT, AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "@/features/auth/storage";

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

type ApiErrorData = {
  error?: string;
  code?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  issues?: Array<{
    path?: string;
    label?: string;
    message?: string;
  }>;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
  blockedUntil?: string;
};

const apiFieldLabels: Record<string, string> = {
  slug: "Identificação > URL",
  title: "Identificação > Título",
  edition: "Identificação > Edição",
  year: "Identificação > Ano",
  date: "Identificação > Período do evento",
  area: "Identificação > Tema principal",
  type: "Identificação > Tipo",
  coverUrl: "Identificação > Imagem do evento",
  presentation: "Identificação > Apresentação",
  themes: "Áreas temáticas",
  committee: "Comissão",
  rules: "Normas",
  previousEditions: "Edições anteriores",
  contact: "Contato",
  "contact.email": "Contato > E-mail",
  "contact.phone": "Contato > Telefone",
  catalog: "Ficha catalográfica",
  "catalog.isbn": "Ficha catalográfica > ISBN",
  "catalog.doi": "Ficha catalográfica > DOI",
  "catalog.publisher": "Ficha catalográfica > Editora",
  "catalog.address": "Ficha catalográfica > Endereço",
};

function getApiFieldLabel(path?: string) {
  if (!path) return "Formulário";
  if (apiFieldLabels[path]) return apiFieldLabels[path];

  const root = path.split(".")[0];
  if (apiFieldLabels[root]) return apiFieldLabels[root];

  return path.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function humanizeApiValidationMessage(message?: string) {
  if (!message) return "verifique este campo.";

  const minimumTextMatch = message.match(/String must contain at least (\d+) character/i);
  if (minimumTextMatch) {
    return `preencha com pelo menos ${minimumTextMatch[1]} caracteres.`;
  }

  const maximumTextMatch = message.match(/String must contain at most (\d+) character/i);
  if (maximumTextMatch) {
    return `use no máximo ${maximumTextMatch[1]} caracteres.`;
  }

  if (/Invalid email/i.test(message)) return "informe um e-mail válido.";
  if (/Invalid url/i.test(message)) return "informe uma URL válida.";
  if (/Required/i.test(message)) return "campo obrigatório.";
  if (/Expected number|received nan/i.test(message)) return "informe um número válido.";

  return message;
}

function getApiValidationMessage(data: ApiErrorData) {
  const issueMessages =
    data.issues
      ?.map((issue) => {
        const label = issue.label ?? getApiFieldLabel(issue.path);
        return `${label}: ${humanizeApiValidationMessage(issue.message)}`;
      })
      .filter(Boolean) ?? [];

  const fieldMessages = Object.entries(data.details?.fieldErrors ?? {}).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => `${getApiFieldLabel(field)}: ${humanizeApiValidationMessage(message)}`),
  );

  const formMessages = data.details?.formErrors?.map(humanizeApiValidationMessage) ?? [];
  const messages = [...issueMessages, ...fieldMessages, ...formMessages];
  const uniqueMessages = Array.from(new Set(messages)).slice(0, 4);

  if (!uniqueMessages.length) return undefined;
  return `Verifique: ${uniqueMessages.join(" ")}`;
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

export function getApiRemainingAttempts(error: unknown) {
  const data = getApiErrorData(error);
  return typeof data?.remainingAttempts === "number" ? data.remainingAttempts : undefined;
}
