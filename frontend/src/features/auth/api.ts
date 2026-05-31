import { api } from "@/lib/api";
import type {
  LoginPayload,
  LoginResponse,
  RegisterAccessAccountPayload,
  RegisterAccessAccountResponse,
  UserAccount,
} from "@/types/acervo";

export async function loginWithPassword(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await api.get<{ user: UserAccount }>("/auth/me");
  return response.data;
}

export async function logoutCurrentSession(token: string) {
  await api.post(
    "/auth/logout",
    undefined,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function registerAccessAccount(payload: RegisterAccessAccountPayload) {
  const response = await api.post<RegisterAccessAccountResponse>("/auth/register", payload);
  return response.data;
}
