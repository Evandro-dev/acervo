import assert from "node:assert/strict";
import test from "node:test";

async function getCatalogHelpers() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";

  const [{ eventCatalogSchema }, { mergeEventCatalog }] = await Promise.all([
    import("../src/lib/contracts.js"),
    import("../src/modules/events/events.service.js"),
  ]);

  return { eventCatalogSchema, mergeEventCatalog };
}

const currentCatalog = {
  isbn: "978-65-02-14535-7",
  doi: "10.1234/exemplo",
  catalogText: "Ficha anterior",
  catalogPdfUrl: "https://store.public.blob.vercel-storage.com/acervo/events/event-1/catalog/ficha.pdf",
  catalogImageUrl: "https://store.public.blob.vercel-storage.com/acervo/events/event-1/catalog/ficha.png",
};

test("accepts null catalog fields and normalizes blank identifiers to null", async () => {
  const { eventCatalogSchema } = await getCatalogHelpers();

  assert.deepEqual(
    eventCatalogSchema.parse({ isbn: "  ", doi: null, text: "   " }),
    { isbn: null, doi: null, text: null },
  );

  assert.deepEqual(
    eventCatalogSchema.parse({
      pdfUrl: "https://store.public.blob.vercel-storage.com/acervo/events/event-1/catalog/ficha.pdf",
    }),
    {
      pdfUrl: "https://store.public.blob.vercel-storage.com/acervo/events/event-1/catalog/ficha.pdf",
    },
  );
});

test("uses null to clear catalog values and preserves omitted fields in partial updates", async () => {
  const { mergeEventCatalog } = await getCatalogHelpers();

  assert.deepEqual(mergeEventCatalog(currentCatalog, { isbn: null, text: null }), {
    isbn: null,
    doi: currentCatalog.doi,
    text: null,
    pdfUrl: currentCatalog.catalogPdfUrl,
    imageUrl: currentCatalog.catalogImageUrl,
  });

  assert.deepEqual(mergeEventCatalog(currentCatalog, {}), {
    isbn: currentCatalog.isbn,
    doi: currentCatalog.doi,
    text: currentCatalog.catalogText,
    pdfUrl: currentCatalog.catalogPdfUrl,
    imageUrl: currentCatalog.catalogImageUrl,
  });
});
