import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePrivilegedUser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { serializeEvent } from "../../lib/serializers.js";
import { getEventInclude } from "./event-list.service.js";

export async function eventReadRoutes(app: FastifyInstance) {
  app.post("/:id/view", async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!event) {
      return reply.status(404).send({ error: "Evento não encontrado" });
    }

    await prisma.event.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });

    return reply.status(204).send();
  });

  app.get("/:idOrSlug", async (req, reply) => {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const query = z
      .object({
        includeArticles: z.enum(["published", "all"]).default("published"),
      })
      .parse(req.query ?? {});

    if (query.includeArticles === "all") {
      const user = await requirePrivilegedUser(req, reply);
      if (!user) return;
    }

    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: getEventInclude(query.includeArticles),
    });

    if (!event) {
      return reply.status(404).send({ error: "Evento não encontrado" });
    }

    return serializeEvent(event);
  });
}
