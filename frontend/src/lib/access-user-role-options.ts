import type { UserRole } from "@/types/acervo";

export const accessUserRoleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "COORDENADOR", label: "Coordenador" },
  { value: "ADMIN", label: "Administrador" },
];
