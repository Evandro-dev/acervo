import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

test("protects XLSX report generation behind privileged roles", async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";
  const { reportRoutes } = await import("../src/modules/reports/reports.routes.js");
  const app = Fastify();
  let protectedRoles: string[] = [];

  app.decorate("requireRole", (...roles: string[]) => {
    protectedRoles = roles;
    return async (_req: unknown, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) =>
      reply.status(403).send({ error: "Acesso negado" });
  });
  await app.register(reportRoutes, { prefix: "/reports" });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/reports/articles.xlsx",
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(protectedRoles, ["ADMIN", "COORDENADOR"]);
  } finally {
    await app.close();
  }
});
