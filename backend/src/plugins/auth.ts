import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthSessionError } from "../modules/auth/auth-session.service.js";
import { verifyActiveRequestSession } from "../modules/auth/auth-request.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: string[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; sid: string; role: string; name: string };
    user: { sub: string; sid: string; role: string; name: string };
  }
}

export const authPlugin = fp(async (app) => {
  async function authenticate(req: FastifyRequest, reply: FastifyReply) {
    try {
      await verifyActiveRequestSession(req);
    } catch (error) {
      if (!(error instanceof AuthSessionError)) throw error;

      reply.header("Cache-Control", "no-store");
      return reply.status(401).send({
        code: error.code,
        error: error.message,
      });
    }
  }

  app.decorate("authenticate", async (req, reply) => {
    return authenticate(req, reply);
  });

  app.decorate("requireRole", (...roles: string[]) => async (req, reply) => {
    await authenticate(req, reply);
    if (reply.sent) return;

    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({ error: "Acesso negado" });
    }
  });
});
