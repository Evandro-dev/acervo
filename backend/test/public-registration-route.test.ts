import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

test("keeps the legacy public registration endpoint unavailable by default", async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";
  process.env.JWT_SECRET ??= "test-only-jwt-secret";
  process.env.PUBLIC_COORDINATOR_REGISTRATION_ENABLED = "false";

  const { authRoutes } = await import("../src/modules/auth/auth.routes.js");
  const app = Fastify();

  app.decorate("authenticate", async () => undefined);
  await app.register(authRoutes, { prefix: "/auth" });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Maria Clara",
        email: "maria@ulife.com.br",
        jobTitle: "Coordenadora de Pesquisa",
        password: "Senha2026",
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      code: "PUBLIC_REGISTRATION_DISABLED",
      error: "O cadastro público está desativado. Solicite seu acesso a um administrador.",
    });
  } finally {
    await app.close();
  }
});
