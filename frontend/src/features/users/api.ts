import { api } from "@/lib/api";
import type { CreateAccessAccountPayload, UpdateAccessAccountPayload, UserAccount } from "@/types/acervo";

export async function fetchAccessUsers() {
  const response = await api.get<UserAccount[]>("/users");
  return response.data;
}

export async function createAccessUser(payload: CreateAccessAccountPayload) {
  const response = await api.post<UserAccount>("/users", payload);
  return response.data;
}

export async function updateAccessUser(userId: string, payload: UpdateAccessAccountPayload) {
  const response = await api.patch<UserAccount>(`/users/${userId}`, payload);
  return response.data;
}

export async function setAccessUserActive(userId: string, isActive: boolean) {
  const action = isActive ? "reactivate" : "deactivate";
  const response = await api.post<UserAccount>(`/users/${userId}/${action}`);
  return response.data;
}
