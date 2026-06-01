import { z } from "zod";

export const accessAccountPasswordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(120)
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra.")
  .regex(/\d/, "A senha deve conter ao menos um número.");

export const accessAccountRoleSchema = z.enum(["ADMIN", "COORDENADOR"]);
