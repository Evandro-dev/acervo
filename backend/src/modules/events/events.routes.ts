import type { FastifyInstance } from "fastify";
import { eventAdminRoutes } from "./events.admin.routes.js";
import { eventFilesRoutes } from "./events.files.routes.js";
import { eventListRoutes } from "./events.list.routes.js";
import { eventMutationRoutes } from "./events.mutations.routes.js";
import { eventReadRoutes } from "./events.read.routes.js";
import { eventOptionsRoutes } from "./events.options.routes.js";

export async function eventRoutes(app: FastifyInstance) {
  await app.register(eventListRoutes);
  await app.register(eventAdminRoutes);
  await app.register(eventOptionsRoutes);
  await app.register(eventFilesRoutes);
  await app.register(eventMutationRoutes);
  await app.register(eventReadRoutes);
}
