import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

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
    payload: { sub: string; role: string; name: string };
    user: { sub: string; role: string; name: string };
  }
}

export const authPlugin = fp(async (app) => {
  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Não autenticado" });
    }
  });

  app.decorate("requireRole", (...roles: string[]) => async (req, reply) => {
    try {
      await req.jwtVerify();
      if (!roles.includes(req.user.role)) {
        return reply.status(403).send({ error: "Acesso negado" });
      }
    } catch {
      return reply.status(401).send({ error: "Não autenticado" });
    }
  });
});
