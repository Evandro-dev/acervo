import assert from "node:assert/strict";
import test from "node:test";
import { articleReportQuerySchema, buildArticleReportWhere } from "../src/modules/reports/article-report.filters.js";

test("builds structured article report filters", () => {
  const filters = articleReportQuerySchema.parse({
    eventId: "event-1",
    area: "Saúde",
    course: "Enfermagem",
    status: "published",
    dateFrom: "2026-01-01",
    dateTo: "2026-06-30",
  });

  assert.deepEqual(buildArticleReportWhere(filters), {
    status: "PUBLISHED",
    eventId: "event-1",
    area: { equals: "Saúde", mode: "insensitive" },
    courses: {
      some: {
        course: {
          normalizedName: "enfermagem",
        },
      },
    },
    submittedAt: {
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-06-30T23:59:59.999Z"),
    },
  });
});

test("rejects inverted article report periods", () => {
  assert.throws(() =>
    articleReportQuerySchema.parse({
      dateFrom: "2026-06-30",
      dateTo: "2026-01-01",
    }),
  );
});

test("rejects nonexistent calendar dates in article report periods", () => {
  assert.throws(() => articleReportQuerySchema.parse({ dateFrom: "2026-02-31" }));
});

test("rejects oversized article report filter values", () => {
  assert.throws(() => articleReportQuerySchema.parse({ course: "a".repeat(161) }));
});

test("normalizes course lookup values in article report filters", () => {
  const filters = articleReportQuerySchema.parse({ course: "  Engenharia   de Software " });

  assert.deepEqual(buildArticleReportWhere(filters), {
    courses: {
      some: {
        course: {
          normalizedName: "engenharia de software",
        },
      },
    },
  });
});
