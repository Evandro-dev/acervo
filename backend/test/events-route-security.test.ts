import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";

test("protects event mutations and rule upload cleanup behind privileged roles", async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";

  const { eventRoutes } = await import("../src/modules/events/events.routes.js");
  const app = Fastify();
  const protectedRoles: string[][] = [];

  app.decorate("requireRole", (...roles: string[]) => {
    protectedRoles.push(roles);

    return async (_request, reply) => {
      return reply.status(403).send({ error: "Acesso negado" });
    };
  });

  await app.register(eventRoutes, { prefix: "/events" });

  try {
    const response = await app.inject({
      method: "DELETE",
      url: "/events/event-1/rules/upload",
      payload: { fileUrl: "https://example.com/norma.pdf" },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(protectedRoles, [
      ["ADMIN", "COORDENADOR"],
      ["ADMIN", "COORDENADOR"],
      ["ADMIN", "COORDENADOR"],
      ["ADMIN", "COORDENADOR"],
      ["ADMIN", "COORDENADOR"],
      ["ADMIN"],
    ]);
  } finally {
    await app.close();
  }
});
