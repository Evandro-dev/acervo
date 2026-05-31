import type { FastifyRequest } from "fastify";
import { AuthSessionError, validateAuthSession } from "./auth-session.service.js";

export async function verifyActiveRequestSession(req: FastifyRequest) {
  try {
    await req.jwtVerify();
  } catch {
    throw new AuthSessionError("UNAUTHENTICATED", "Não autenticado");
  }

  const activeUser = await validateAuthSession(req.user.sid, req.user.sub);
  req.user = activeUser;
  return activeUser;
}
