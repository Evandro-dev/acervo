import type { FastifyInstance, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { accessAccountPasswordSchema, accessAccountRoleSchema } from "../../lib/access-account.schemas.js";
import { normalizeEmailAddress } from "../../lib/institutional-email.js";
import { prisma } from "../../lib/prisma.js";
import { isPrismaUniqueConstraintError } from "../../lib/prisma-errors.js";
import { serializeUserAccount } from "../../lib/serializers.js";

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

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: accessAccountPasswordSchema,
  role: accessAccountRoleSchema,
  jobTitle: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  area: z.string().trim().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  jobTitle: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  area: z.string().trim().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

function preventAccessAccountResponseCaching(reply: FastifyReply) {
  reply.header("Cache-Control", "no-store");
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireRole("ADMIN")] }, async (_req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const users = await prisma.user.findMany({
      select: accountSelect,
      orderBy: { name: "asc" },
    });

    return users.map(serializeUserAccount);
  });

  app.post("/", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const payload = createSchema.parse(req.body);
    const email = normalizeEmailAddress(payload.email);
    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      return reply.status(409).send({
        code: "ACCOUNT_EXISTS",
        error: "Já existe uma conta com este e-mail.",
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
          role: payload.role,
          jobTitle: payload.jobTitle,
          bio: payload.bio,
          area: payload.area,
          avatarUrl: payload.avatarUrl,
        },
        select: accountSelect,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return reply.status(409).send({
          code: "ACCOUNT_EXISTS",
          error: "Já existe uma conta com este e-mail.",
        });
      }

      throw error;
    }

    req.log.info({
      event: "access-account.created",
      actorUserId: req.user.sub,
      userId: user.id,
      role: user.role,
    });

    return reply.status(201).send(serializeUserAccount(user));
  });

  app.get("/:id", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: accountSelect,
    });

    if (!user) return reply.status(404).send({ error: "Conta de acesso não encontrada" });
    return serializeUserAccount(user);
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (req) => {
    const data = updateSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data,
      select: accountSelect,
    });

    return serializeUserAccount(user);
  });
}
