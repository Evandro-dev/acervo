import type { FastifyInstance } from "fastify";
import { getEventDashboardSummary } from "./event-list.service.js";

export async function eventAdminRoutes(app: FastifyInstance) {
  app.get(
    "/dashboard-summary",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async () => getEventDashboardSummary(),
  );
}
