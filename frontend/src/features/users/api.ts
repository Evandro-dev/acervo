import { api } from "@/lib/api";
import type { CreateAccessAccountPayload, UserAccount } from "@/types/acervo";

export async function fetchAccessUsers() {
  const response = await api.get<UserAccount[]>("/users");
  return response.data;
}

export async function createAccessUser(payload: CreateAccessAccountPayload) {
  const response = await api.post<UserAccount>("/users", payload);
  return response.data;
}
