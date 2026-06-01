import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { accessAccountPasswordSchema, accessAccountRoleSchema } from "../../lib/access-account.schemas.js";
import { prisma } from "../../lib/prisma.js";
import { serializeUserAccount } from "../../lib/serializers.js";
import {
  AccessAccountManagementError,
  createManagedAccessAccount,
  deactivateManagedAccessAccount,
  managedAccessAccountSelect,
  reactivateManagedAccessAccount,
  updateManagedAccessAccount,
} from "./access-account-management.service.js";

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

const selfUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  jobTitle: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  area: z.string().trim().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

const administrativeUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(180).optional(),
    password: accessAccountPasswordSchema.optional(),
    role: accessAccountRoleSchema.optional(),
    jobTitle: z.string().trim().max(120).nullable().optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });

function preventAccessAccountResponseCaching(reply: FastifyReply) {
  reply.header("Cache-Control", "no-store");
}

function sendManagementError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof AccessAccountManagementError)) throw error;

  return reply.status(error.statusCode).send({
    code: error.code,
    error: error.message,
  });
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireRole("ADMIN")] }, async (_req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const users = await prisma.user.findMany({
      select: managedAccessAccountSelect,
      orderBy: { name: "asc" },
    });

    return users.map(serializeUserAccount);
  });

  app.post("/", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const payload = createSchema.parse(req.body);

    try {
      const result = await createManagedAccessAccount(req.user.sub, payload);
      req.log.info({
        event: "access-account.created",
        actorUserId: req.user.sub,
        targetUserId: result.user.id,
        role: result.user.role,
      });
      return reply.status(201).send(serializeUserAccount(result.user));
    } catch (error) {
      return sendManagementError(error, reply);
    }
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (req) => {
    const data = selfUpdateSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data,
      select: managedAccessAccountSelect,
    });

    return serializeUserAccount(user);
  });

  app.get("/:id", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: managedAccessAccountSelect,
    });

    if (!user) return reply.status(404).send({ error: "Conta de acesso não encontrada." });
    return serializeUserAccount(user);
  });

  app.patch("/:id", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const { id } = req.params as { id: string };
    const payload = administrativeUpdateSchema.parse(req.body);

    try {
      const result = await updateManagedAccessAccount(req.user.sub, id, payload);
      req.log.info({
        event: "access-account.updated",
        actorUserId: req.user.sub,
        targetUserId: result.user.id,
        changedFields: result.changedFields,
        revokedSessionCount: result.revokedSessionCount,
      });
      return serializeUserAccount(result.user);
    } catch (error) {
      return sendManagementError(error, reply);
    }
  });

  app.post("/:id/deactivate", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const { id } = req.params as { id: string };

    try {
      const result = await deactivateManagedAccessAccount(req.user.sub, id);
      req.log.info({
        event: "access-account.deactivated",
        actorUserId: req.user.sub,
        targetUserId: result.user.id,
        revokedSessionCount: result.revokedSessionCount,
      });
      return serializeUserAccount(result.user);
    } catch (error) {
      return sendManagementError(error, reply);
    }
  });

  app.post("/:id/reactivate", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    preventAccessAccountResponseCaching(reply);
    const { id } = req.params as { id: string };

    try {
      const result = await reactivateManagedAccessAccount(req.user.sub, id);
      req.log.info({
        event: "access-account.reactivated",
        actorUserId: req.user.sub,
        targetUserId: result.user.id,
      });
      return serializeUserAccount(result.user);
    } catch (error) {
      return sendManagementError(error, reply);
    }
  });
}
