import type { FastifyInstance, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../../env.js";
import {
  formatInstitutionalEmailDomains,
  isInstitutionalEmail,
  normalizeEmailAddress,
} from "../../lib/institutional-email.js";
import { accessAccountPasswordSchema } from "../../lib/access-account.schemas.js";
import { prisma } from "../../lib/prisma.js";
import { isPrismaUniqueConstraintError } from "../../lib/prisma-errors.js";
import { serializeUserAccount } from "../../lib/serializers.js";
import { createExclusiveAuthSession, revokeAuthSession } from "./auth-session.service.js";
import {
  clearAccountLoginFailures,
  getLoginAuditContext,
  reserveLoginAttempt,
} from "./login-throttle.service.js";
import { getPublicCoordinatorRegistrationRestriction } from "./public-registration.policy.js";

const accountSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  jobTitle: true,
  bio: true,
  area: true,
  avatarUrl: true,
} as const;

const loginSchema = z.object({
  email: z.string().trim().max(180).default(""),
  password: z.string().max(120).default(""),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  jobTitle: z.string().trim().min(2).max(120),
  password: accessAccountPasswordSchema,
});

// Comparing against a real bcrypt hash for unknown accounts reduces timing-based user enumeration.
const unknownAccountPasswordHash = "$2b$10$wnVhQ4C0JcBFaHtkmVXQt.ET6kn72YvJd.D1oFOzK4K5YPvm6rWyC";

function buildRateLimitPayload(retryAfterSeconds: number) {
  return {
    code: "LOGIN_RATE_LIMITED",
    error: `Muitas tentativas de login. Tente novamente em ${retryAfterSeconds} segundos.`,
    retryAfterSeconds,
    blockedUntil: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
  };
}

function preventAuthResponseCaching(reply: FastifyReply) {
  reply.header("Cache-Control", "no-store");
}

function signToken(
  app: FastifyInstance,
  user: { id: string; role: string; name: string },
  sessionId: string,
) {
  return app.jwt.sign(
    { sub: user.id, sid: sessionId, role: user.role, name: user.name },
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    preventAuthResponseCaching(reply);
    const parsed = loginSchema.parse(req.body);
    const email = normalizeEmailAddress(parsed.email);
    const auditContext = getLoginAuditContext(email, req.ip);
    const attempt = await reserveLoginAttempt(email, req.ip);

    if (!attempt.accepted) {
      req.log.warn({ event: "auth.login.blocked", ...auditContext, scope: attempt.scope });
      reply.header("Retry-After", String(attempt.retryAfterSeconds));
      return reply.status(429).send(buildRateLimitPayload(attempt.retryAfterSeconds));
    }

    const user = email
      ? await prisma.user.findUnique({
          where: { email },
          select: {
            ...accountSelect,
            passwordHash: true,
          },
        })
      : null;

    const ok = await bcrypt.compare(parsed.password || "__empty__", user?.passwordHash ?? unknownAccountPasswordHash);

    if (!user || !ok) {
      req.log.warn({
        event: "auth.login.failed",
        ...auditContext,
        blocked: attempt.blocked,
        scope: attempt.scope,
        remainingAttempts: attempt.remainingAttempts,
      });

      if (attempt.blocked) {
        reply.header("Retry-After", String(attempt.retryAfterSeconds));
      }

      return reply.status(attempt.blocked ? 429 : 401).send({
        ...(attempt.blocked
          ? buildRateLimitPayload(attempt.retryAfterSeconds)
          : {
              code: "INVALID_CREDENTIALS",
              error: "Credenciais inválidas",
            }),
      });
    }

    await clearAccountLoginFailures(email);

    const session = await createExclusiveAuthSession({
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    const token = signToken(app, user, session.id);

    req.log.info({
      event: "auth.login.succeeded",
      ...auditContext,
      userId: user.id,
      revokedSessionCount: session.revokedSessionCount,
    });

    return { user: serializeUserAccount(user), token };
  });

  app.post("/logout", { preHandler: [app.authenticate] }, async (req, reply) => {
    preventAuthResponseCaching(reply);
    await revokeAuthSession(req.user.sid);
    req.log.info({ event: "auth.logout.succeeded", userId: req.user.sub });
    return reply.status(204).send();
  });

  app.post("/register", async (req, reply) => {
    preventAuthResponseCaching(reply);
    const restriction = getPublicCoordinatorRegistrationRestriction(env.PUBLIC_COORDINATOR_REGISTRATION_ENABLED);

    if (restriction) {
      req.log.warn({ event: "auth.register.disabled_attempt" });
      return reply.status(404).send(restriction);
    }

    const payload = registerSchema.parse(req.body);
    const email = normalizeEmailAddress(payload.email);

    if (!isInstitutionalEmail(email, env.INSTITUTIONAL_EMAIL_DOMAINS)) {
      return reply.status(400).send({
        code: "INVALID_INSTITUTIONAL_EMAIL",
        error: `Use um e-mail institucional ${formatInstitutionalEmailDomains(env.INSTITUTIONAL_EMAIL_DOMAINS)}.`,
      });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return reply.status(409).send({
        code: "ACCOUNT_EXISTS",
        error: "Já existe uma conta com este e-mail institucional.",
      });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    let user;

    try {
      user = await prisma.user.create({
        data: {
          name: payload.name,
          email,
          passwordHash,
          role: "COORDENADOR",
          jobTitle: payload.jobTitle,
        },
        select: accountSelect,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return reply.status(409).send({
          code: "ACCOUNT_EXISTS",
          error: "Já existe uma conta com este e-mail institucional.",
        });
      }

      throw error;
    }

    return reply.status(201).send({
      message: "Conta criada com sucesso. Entre com suas credenciais para acessar o painel.",
      user: serializeUserAccount(user),
    });
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    preventAuthResponseCaching(reply);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: accountSelect,
    });

    return { user: serializeUserAccount(user) };
  });
}
