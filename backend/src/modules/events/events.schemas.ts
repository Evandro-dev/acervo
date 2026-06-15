import { z } from "zod";
import {
  eventCatalogSchema,
  eventCommitteeSchema,
  eventContactSchema,
  eventPreviousEditionsSchema,
  eventRulesSchema,
  eventTypeSchema,
} from "../../lib/contracts.js";

export const eventPayloadSchema = z.object({
  slug: z.string().min(2).max(160).optional(),
  title: z.string().min(2).max(200),
  edition: z.string().max(120).default(""),
  year: z.coerce.number().int().min(1900).max(3000),
  date: z.string().min(2).max(120),
  area: z.string().min(1).max(120),
  type: eventTypeSchema,
  coverUrl: z.url().nullable().optional(),
  presentation: z.string().min(10),
  themes: z.array(z.string().min(1).max(120)).default([]),
  committee: eventCommitteeSchema.default([]),
  rules: eventRulesSchema.default([]),
  previousEditions: eventPreviousEditionsSchema.default([]),
  contact: eventContactSchema,
  catalog: eventCatalogSchema.default({}),
});

export type EventPayload = z.infer<typeof eventPayloadSchema>;

export const eventRuleUploadCleanupSchema = z.object({
  fileUrl: z.string().trim().min(1).max(1_000),
});
