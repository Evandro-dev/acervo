import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { applyDefaultResponseHeaders } from "../src/lib/response-headers.js";

test("adds nosniff and short public cache headers to public GET responses", async () => {
  const app = Fastify();
  app.addHook("onSend", async (req, reply, payload) => {
    applyDefaultResponseHeaders(req, reply);
    return payload;
  });
  app.get("/areas", async () => ({ ok: true }));

  const response = await app.inject({ method: "GET", url: "/areas" });

  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["cache-control"], "public, max-age=60, stale-while-revalidate=300");
});

test("uses no-store for authenticated or sensitive API responses", async () => {
  const app = Fastify();
  app.addHook("onSend", async (req, reply, payload) => {
    applyDefaultResponseHeaders(req, reply);
    return payload;
  });
  app.get("/auth/me", async () => ({ ok: true }));
  app.get("/events", async () => ({ ok: true }));

  const authResponse = await app.inject({ method: "GET", url: "/auth/me" });
  const authorizedPublicResponse = await app.inject({
    method: "GET",
    url: "/events",
    headers: { Authorization: "Bearer token" },
  });

  assert.equal(authResponse.headers["cache-control"], "no-store");
  assert.equal(authorizedPublicResponse.headers["cache-control"], "no-store");
});

test("does not override route-specific cache headers", async () => {
  const app = Fastify();
  app.addHook("onSend", async (req, reply, payload) => {
    applyDefaultResponseHeaders(req, reply);
    return payload;
  });
  app.get("/asset", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return "asset";
  });

  const response = await app.inject({ method: "GET", url: "/asset" });

  assert.equal(response.headers["cache-control"], "public, max-age=31536000, immutable");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
});
