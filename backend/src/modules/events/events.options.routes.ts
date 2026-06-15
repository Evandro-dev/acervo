import type { FastifyInstance } from "fastify";
import { listEventOptions } from "./event-list.service.js";

export async function eventOptionsRoutes(app: FastifyInstance) {
  app.get("/options", async () => listEventOptions());
}
