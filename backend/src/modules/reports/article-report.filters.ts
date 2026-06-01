import { z } from "zod";
import { normalizeCourseLookup } from "../courses/courses.service.js";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Informe uma data válida.");

export const articleReportStatusSchema = z.enum(["all", "published", "draft", "archived"]);

export const articleReportQuerySchema = z
  .object({
    eventId: z.string().trim().max(120).optional(),
    area: z.string().trim().max(120).optional(),
    course: z.string().trim().max(160).optional(),
    status: articleReportStatusSchema.default("all"),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
  })
  .refine((filters) => !filters.dateFrom || !filters.dateTo || filters.dateFrom <= filters.dateTo, {
    message: "A data final deve ser igual ou posterior à data inicial.",
    path: ["dateTo"],
  });

export type ArticleReportFilters = z.infer<typeof articleReportQuerySchema>;

function getStatusFilter(status: ArticleReportFilters["status"]) {
  switch (status) {
    case "published":
      return "PUBLISHED" as const;
    case "draft":
      return "DRAFT" as const;
    case "archived":
      return "ARCHIVED" as const;
    default:
      return undefined;
  }
}

export function buildArticleReportWhere(filters: ArticleReportFilters) {
  const status = getStatusFilter(filters.status);
  const submittedAt =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}),
          ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
        }
      : undefined;

  return {
    ...(status ? { status } : {}),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.area ? { area: { equals: filters.area, mode: "insensitive" as const } } : {}),
    ...(filters.course
      ? {
          courses: {
            some: {
              course: {
                normalizedName: normalizeCourseLookup(filters.course),
              },
            },
          },
        }
      : {}),
    ...(submittedAt ? { submittedAt } : {}),
  };
}
