import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

test("protects access account management routes behind the administrator role", async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";
  process.env.JWT_SECRET ??= "test-only-jwt-secret";
  const { userRoutes } = await import("../src/modules/users/users.routes.js");
  const app = Fastify();
  const protectedRoles: string[][] = [];

  app.decorate("authenticate", async (_req: unknown, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) =>
    reply.status(403).send({ error: "Acesso negado" }),
  );
  app.decorate("requireRole", (...roles: string[]) => {
    protectedRoles.push(roles);
    return async (_req: unknown, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) =>
      reply.status(403).send({ error: "Acesso negado" });
  });
  await app.register(userRoutes, { prefix: "/users" });

  try {
    const operations = [
      { method: "GET", url: "/users" },
      { method: "POST", url: "/users" },
      { method: "GET", url: "/users/user-1" },
      { method: "PATCH", url: "/users/user-1" },
      { method: "POST", url: "/users/user-1/deactivate" },
      { method: "POST", url: "/users/user-1/reactivate" },
    ] as const;

    for (const operation of operations) {
      const response = await app.inject(operation);
      assert.equal(response.statusCode, 403);
    }

    assert.deepEqual(protectedRoles, [
      ["ADMIN"],
      ["ADMIN"],
      ["ADMIN"],
      ["ADMIN"],
      ["ADMIN"],
      ["ADMIN"],
    ]);
  } finally {
    await app.close();
  }
});
