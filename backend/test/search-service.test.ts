import assert from "node:assert/strict";
import test from "node:test";
import { searchAcervo } from "../src/modules/search/search.service.js";

const publishedArticle = {
  id: "article-1",
  title: "Anemia Ferropriva: uma análise e discussão",
  abstract: "Resumo sobre saúde e anemia.",
  area: "Saúde",
  pages: "1-5",
  pdfUrl: "https://example.com/article.pdf",
  viewCount: 0,
  downloadCount: 0,
  status: "PUBLISHED",
  modality: "Resumo Expandido",
  importedFrom: null,
  externalId: null,
  submittedAt: new Date("2026-06-01"),
  importedAt: null,
  publishedAt: new Date("2026-06-02"),
  authors: [
    {
      position: 0,
      author: {
        id: "author-1",
        slug: "maria-clara",
        name: "Maria Clara",
        bio: null,
        area: null,
        avatarUrl: null,
      },
    },
  ],
  courses: [{ position: 0, course: { name: "Biomedicina" } }],
  event: { id: "event-1", slug: "expo-una-2025-2", title: "EXPO UNA 2025/2", year: 2026 },
};

function createDatabase() {
  const calls: Record<string, unknown[]> = {
    article: [],
    event: [],
    author: [],
    area: [],
    course: [],
  };

  return {
    calls,
    database: {
      article: {
        async findMany(args: unknown) {
          calls.article.push(args);
          return [publishedArticle];
        },
      },
      event: {
        async findMany(args: unknown) {
          calls.event.push(args);
          return [
            {
              id: "event-1",
              slug: "expo-una-2025-2",
              title: "EXPO UNA 2025/2",
              edition: "1ª Edição",
              year: 2026,
              date: "1 a 5 de dezembro de 2026",
              area: "Saúde",
              type: "Expo",
              viewCount: 0,
              coverUrl: null,
              presentation: "Mostra acadêmica da UNA.",
              themes: ["Saúde"],
              committee: [],
              rules: [],
              previousEditions: [],
              contactEmail: "evento@acervo.edu",
              contactPhone: null,
              isbn: null,
              doi: null,
              publisher: null,
              address: null,
              _count: { articles: 1 },
            },
          ];
        },
      },
      author: {
        async findMany(args: unknown) {
          calls.author.push(args);
          return [
            {
              id: "author-1",
              slug: "maria-clara",
              name: "Maria Clara",
              bio: null,
              area: null,
              avatarUrl: null,
              articles: [{ article: { area: "Saúde" } }],
            },
          ];
        },
      },
      area: {
        async findMany(args: unknown) {
          calls.area.push(args);
          return [{ id: "area-1", name: "Saúde", _count: { articles: 1 } }];
        },
      },
      course: {
        async findMany(args: unknown) {
          calls.course.push(args);
          return [{ id: "course-1", name: "Biomedicina", _count: { articles: 1 } }];
        },
      },
    },
  };
}

test("builds grouped global search results with public destinations", async () => {
  const { database } = createDatabase();

  const result = await searchAcervo(database, "anemia", { limitPerType: 3 });

  assert.equal(result.query, "anemia");
  assert.equal(result.total, 5);
  assert.equal(result.groups.article[0].href, "/eventos/expo-una-2025-2/artigos/article-1");
  assert.equal(result.groups.article[0].type, "article");
  assert.ok(result.groups.article[0].matchedFields.includes("Título"));
  assert.equal(result.groups.event[0].href, "/eventos/expo-una-2025-2");
  assert.equal(result.groups.author[0].href, "/autores/maria-clara");
  assert.equal(result.groups.area[0].href, "/publicacoes?area=Sa%C3%BAde");
  assert.equal(result.groups.course[0].href, "/publicacoes?course=Biomedicina");
});

test("does not query the database for too-short global searches", async () => {
  const { database, calls } = createDatabase();

  const result = await searchAcervo(database, "a", { limitPerType: 3 });

  assert.equal(result.total, 0);
  assert.deepEqual(calls.article, []);
  assert.deepEqual(calls.event, []);
  assert.deepEqual(calls.author, []);
});

test("requests only published articles for public global search", async () => {
  const { database, calls } = createDatabase();

  await searchAcervo(database, "anemia", { limitPerType: 3 });

  assert.equal((calls.article[0] as any).where.status, "PUBLISHED");
  assert.equal((calls.article[1] as any).where.status, "PUBLISHED");
  assert.deepEqual((calls.author[0] as any).where.articles, { some: { article: { status: "PUBLISHED" } } });
});

test("uses a bounded normalized fallback for searches typed without accents", async () => {
  const { database, calls } = createDatabase();
  let articleCalls = 0;

  database.article.findMany = async (args: unknown) => {
    calls.article.push(args);
    articleCalls += 1;
    return articleCalls === 1 ? [] : [publishedArticle];
  };

  const result = await searchAcervo(database, "saude", { limitPerType: 3 });

  assert.equal(result.groups.article[0].title, publishedArticle.title);
  assert.equal((calls.article[1] as any).take, 48);
  assert.equal((calls.article[1] as any).where.status, "PUBLISHED");
});

test("clamps excessive global search limits before querying", async () => {
  const { database, calls } = createDatabase();

  await searchAcervo(database, "anemia", { limitPerType: 99 });

  assert.equal((calls.article[0] as any).take, 24);
  assert.equal((calls.article[1] as any).take, 120);
});
