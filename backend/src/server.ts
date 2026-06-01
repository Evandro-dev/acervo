import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { PDF_UPLOAD_LIMIT_BYTES } from "./lib/pdf-upload.js";
import { getPublicErrorMessage } from "./lib/public-error-message.js";
import { env } from "./env.js";
import { authPlugin } from "./plugins/auth.js";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { authorRoutes } from "./modules/authors/authors.routes.js";
import { areaRoutes } from "./modules/areas/areas.routes.js";
import { eventRoutes } from "./modules/events/events.routes.js";
import { articleRoutes } from "./modules/articles/articles.routes.js";
import { courseRoutes } from "./modules/courses/courses.routes.js";
import { reportRoutes } from "./modules/reports/reports.routes.js";

const app = Fastify({ logger: true, trustProxy: env.TRUST_PROXY_HOPS });

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

const allowedOrigins = new Set(
  env.CORS_ORIGIN.split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
);

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    // Allow all origins when the environment contains a wildcard '*'
    if (allowedOrigins.has("*")) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(normalizeOrigin(origin)));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(multipart, { limits: { fileSize: PDF_UPLOAD_LIMIT_BYTES, files: 1 } });
await app.register(authPlugin);

function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (typeof error === "object" && error !== null && "issues" in error && "flatten" in error)
  );
}

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);

  if (isZodError(error)) {
    return reply.status(400).send({
      error: "Dados inválidos",
      details: error.flatten(),
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }

  if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
    return reply.status(413).send({ error: "O arquivo excede o limite de 25 MB." });
  }

  const status = (error as { statusCode?: number }).statusCode ?? 500;
  const message = getPublicErrorMessage(error, status);
  return reply.status(status).send({ error: message });
});

app.get("/health", async () => ({ ok: true, service: "acervo-api" }));

await app.register(authRoutes, { prefix: "/auth" });
await app.register(userRoutes, { prefix: "/users" });
await app.register(authorRoutes, { prefix: "/authors" });
await app.register(areaRoutes, { prefix: "/areas" });
await app.register(courseRoutes, { prefix: "/courses" });
await app.register(reportRoutes, { prefix: "/reports" });
await app.register(eventRoutes, { prefix: "/events" });
await app.register(articleRoutes, { prefix: "/articles" });

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`ACERVO API listening on :${env.PORT}`))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
