import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
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

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(120)
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra.")
  .regex(/\d/, "A senha deve conter ao menos um número.");

const privilegedRoleSchema = z.enum(["ADMIN", "COORDENADOR"]);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  password: passwordSchema,
  role: privilegedRoleSchema,
  jobTitle: z.string().min(2).max(120).optional(),
  bio: z.string().max(500).optional(),
  area: z.string().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  bio: z.string().max(500).optional(),
  area: z.string().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireRole("ADMIN")] }, async () => {
    const users = await prisma.user.findMany({
      select: accountSelect,
      orderBy: { name: "asc" },
    });

    return users.map(serializeUserAccount);
  });

  app.post("/", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    const payload = createSchema.parse(req.body);
    const email = normalizeEmail(payload.email);
    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      return reply.status(409).send({ error: "Já existe uma conta com este e-mail institucional." });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
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

    return reply.status(201).send(serializeUserAccount(user));
  });

  app.get("/:id", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
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
