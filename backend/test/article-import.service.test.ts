import assert from "node:assert/strict";
import test from "node:test";

import {
  ARTICLE_IMPORT_TRANSACTION_MAX_WAIT_MS,
  ARTICLE_IMPORT_TRANSACTION_TIMEOUT_MS,
  createImportedArticles,
} from "../src/modules/articles/article-import.service.js";

test("resolves catalogs before opening the bounded article creation transaction", async () => {
  const calls: string[] = [];
  const areas = new Map<string, { id: string; name: string }>();
  const courses = new Map<string, { id: string; name: string }>();
  const authors = new Map<string, { id: string; name: string; slug: string }>();
  const database = {
    area: {
      findUnique: async ({ where: { normalizedName } }: { where: { normalizedName: string } }) =>
        areas.get(normalizedName) ?? null,
      create: async ({ data }: { data: { name: string; normalizedName: string } }) => {
        const area = { id: `area-${areas.size + 1}`, name: data.name };
        areas.set(data.normalizedName, area);
        calls.push(`area:${data.name}`);
        return area;
      },
    },
    course: {
      upsert: async ({ create }: { create: { name: string; normalizedName: string } }) => {
        const existing = courses.get(create.normalizedName);
        if (existing) return existing;
        const course = { id: `course-${courses.size + 1}`, name: create.name };
        courses.set(create.normalizedName, course);
        calls.push(`course:${create.name}`);
        return course;
      },
    },
    author: {
      findFirst: async ({ where: { name: { equals } } }: { where: { name: { equals: string } } }) =>
        authors.get(equals.toLocaleLowerCase()) ?? null,
      findMany: async () => [],
      create: async ({ data }: { data: { name: string; slug: string } }) => {
        const author = { id: `author-${authors.size + 1}`, name: data.name, slug: data.slug };
        authors.set(data.name.toLocaleLowerCase(), author);
        calls.push(`author:${data.name}`);
        return author;
      },
    },
    article: {
      create: async () => {
        throw new Error("Articles must be created only inside the bounded transaction.");
      },
    },
    $transaction: async (
      callback: (transaction: { article: { create: (args: unknown) => Promise<unknown> } }) => Promise<unknown[]>,
      options: { maxWait: number; timeout: number },
    ) => {
      calls.push("transaction:bounded");
      assert.deepEqual(options, {
        maxWait: ARTICLE_IMPORT_TRANSACTION_MAX_WAIT_MS,
        timeout: ARTICLE_IMPORT_TRANSACTION_TIMEOUT_MS,
      });

      return callback({
        article: {
          create: async (args: unknown) => {
            calls.push("article:create");
            return args;
          },
        },
      });
    },
  };

  const created = await createImportedArticles(database as never, {
    eventId: "event-1",
    createdById: "user-1",
    publishImmediately: false,
    include: {},
    items: [
      {
        title: "Trabalho 1",
        abstract: "",
        area: "Saude",
        courses: ["Biomedicina"],
        authors: [{ name: "Ana Silva" }],
      },
      {
        title: "Trabalho 2",
        abstract: "",
        area: "Saude",
        courses: ["Biomedicina", "Enfermagem"],
        authors: [{ name: "Ana Silva" }, { name: "Carlos Lima" }],
      },
    ],
  });

  assert.equal(created.length, 2);
  assert.equal(calls.filter((call) => call === "area:Saude").length, 1);
  assert.equal(calls.filter((call) => call === "course:Biomedicina").length, 1);
  assert.equal(calls.filter((call) => call === "course:Enfermagem").length, 1);
  assert.deepEqual(calls.slice(-3), ["transaction:bounded", "article:create", "article:create"]);
});
