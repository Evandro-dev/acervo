/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance } from "fastify";
import { createPaginatedResponse, getPaginationParams } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { requirePrivilegedUser } from "../../lib/permissions.js";
import { serializeEvent } from "../../lib/serializers.js";
import {
  buildEventWhere,
  eventListOrderBy,
  eventQuerySchema,
  getEventInclude,
} from "./event-list.service.js";

export async function eventListRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const query = eventQuerySchema.parse(req.query ?? {});
    const pagination = getPaginationParams(query);

    if (query.includeArticles === "all") {
      const user = await requirePrivilegedUser(req, reply);
      if (!user) return;
    }

    const where = buildEventWhere(query);

    const [total, events] = await prisma.$transaction([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy: eventListOrderBy,
        include: getEventInclude(query.includeArticles),
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    return createPaginatedResponse(
      events.map((event: any) =>
        serializeEvent(event, {
          includeArticles: query.includeArticles !== "none",
        }),
      ),
      total,
      pagination,
    );
  });
}
