import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { serializeUserAccount } from "../../lib/serializers.js";
import { clearLoginFailures, getLoginBlock, recordLoginFailure } from "./login-guard.js";

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

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(120)
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra.")
  .regex(/\d/, "A senha deve conter ao menos um número.");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(180),
  jobTitle: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isInstitutionalEmail(email: string) {
  return email.endsWith(`@${env.INSTITUTIONAL_EMAIL_DOMAIN}`);
}

function buildRateLimitPayload(retryAfterSeconds: number, scope?: string) {
  return {
    code: "LOGIN_RATE_LIMITED",
    error: `Muitas tentativas de login. Tente novamente em ${retryAfterSeconds} segundos.`,
    retryAfterSeconds,
    blockedUntil: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
    scope,
  };
}

function signToken(app: FastifyInstance, user: { id: string; role: string; name: string }) {
  return app.jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.parse(req.body);
    const email = normalizeEmail(parsed.email);
    const block = getLoginBlock(email, req.ip);

    if (block.blocked) {
      reply.header("Retry-After", String(block.retryAfterSeconds));
      return reply.status(429).send(buildRateLimitPayload(block.retryAfterSeconds, block.scope));
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

    const ok = user && parsed.password ? await bcrypt.compare(parsed.password, user.passwordHash) : false;

    if (!user || !ok) {
      const nextBlock = recordLoginFailure(email, req.ip);
      if (nextBlock.blocked) {
        reply.header("Retry-After", String(nextBlock.retryAfterSeconds));
      }

      return reply.status(nextBlock.blocked ? 429 : 401).send({
        ...(nextBlock.blocked
          ? buildRateLimitPayload(nextBlock.retryAfterSeconds, nextBlock.scope)
          : {
              code: "INVALID_CREDENTIALS",
              error: "Credenciais inválidas",
              remainingAttempts: nextBlock.remainingAttempts,
            }),
      });
    }

    clearLoginFailures(email, req.ip);

    const token = signToken(app, user);
    return { user: serializeUserAccount(user), token };
  });

  app.post("/register", async (req, reply) => {
    const payload = registerSchema.parse(req.body);
    const email = normalizeEmail(payload.email);

    if (!isInstitutionalEmail(email)) {
      return reply.status(400).send({
        code: "INVALID_INSTITUTIONAL_EMAIL",
        error: `Use um e-mail institucional @${env.INSTITUTIONAL_EMAIL_DOMAIN}.`,
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
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email,
        passwordHash,
        role: "COORDENADOR",
        jobTitle: payload.jobTitle,
      },
      select: accountSelect,
    });

    return reply.status(201).send({
      message: "Conta criada com sucesso. Entre com suas credenciais para acessar o painel.",
      user: serializeUserAccount(user),
    });
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: accountSelect,
    });

    return { user: serializeUserAccount(user) };
  });
}
