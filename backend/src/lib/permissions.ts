import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthSessionError } from "../modules/auth/auth-session.service.js";
import { verifyActiveRequestSession } from "../modules/auth/auth-request.js";

const privilegedRoles = new Set(["ADMIN", "COORDENADOR"]);

export function isPrivilegedRole(role?: string): role is "ADMIN" | "COORDENADOR" {
  return role !== undefined && privilegedRoles.has(role);
}

export async function getOptionalUser(req: FastifyRequest) {
  try {
    return await verifyActiveRequestSession(req);
  } catch (error) {
    if (error instanceof AuthSessionError) return null;
    throw error;
  }
}

export async function requirePrivilegedUser(req: FastifyRequest, reply: FastifyReply) {
  const user = await getOptionalUser(req);

  if (!user) {
    reply.status(401).send({ error: "Não autenticado" });
    return null;
  }

  if (!isPrivilegedRole(user.role)) {
    reply.status(403).send({ error: "Acesso negado" });
    return null;
  }

  return user;
}

export function canManageArticle(user: { sub: string; role: string } | null, createdById: string | null) {
  if (!user) return false;
  return isPrivilegedRole(user.role) || createdById === user.sub;
}
