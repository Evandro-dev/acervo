import assert from "node:assert/strict";
import test from "node:test";
import {
  isManagedPublicBlobUrl,
  isPublicBlobStorageConfigured,
  removePublicBlob,
  type PublicBlobClient,
  uploadPublicBlob,
} from "../src/lib/public-blob-storage.js";

function createClient() {
  const uploads: Array<{ pathname: string; options: unknown }> = [];
  const removals: Array<{ url: string; options: unknown }> = [];

  const client: PublicBlobClient = {
    async put(pathname, _body, options) {
      uploads.push({ pathname, options });
      return { url: `https://store.public.blob.vercel-storage.com/${pathname}` };
    },
    async del(url, options) {
      removals.push({ url, options });
    },
  };

  return { client, removals, uploads };
}

test("detects whether Blob storage has a usable token", () => {
  assert.equal(isPublicBlobStorageConfigured(""), false);
  assert.equal(isPublicBlobStorageConfigured("  "), false);
  assert.equal(isPublicBlobStorageConfigured("token-de-teste"), true);
});

test("uploads public files with an explicit token and stable pathname", async () => {
  const { client, uploads } = createClient();

  const url = await uploadPublicBlob(
    "acervo/events/event-1/covers/capa.png",
    Buffer.from("imagem"),
    "image/png",
    { client, token: "token-de-teste" },
  );

  assert.equal(url, "https://store.public.blob.vercel-storage.com/acervo/events/event-1/covers/capa.png");
  assert.deepEqual(uploads, [
    {
      pathname: "acervo/events/event-1/covers/capa.png",
      options: {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/png",
        token: "token-de-teste",
      },
    },
  ]);
});

test("keeps local fallback when Blob storage has no token", async () => {
  const { client, uploads } = createClient();

  const url = await uploadPublicBlob("acervo/articles/article-1/file.pdf", Buffer.from("pdf"), "application/pdf", {
    client,
    token: null,
  });

  assert.equal(url, null);
  assert.deepEqual(uploads, []);
});

test("recognizes and removes only managed public Blob URLs", async () => {
  const { client, removals } = createClient();
  const managedUrl = "https://store.public.blob.vercel-storage.com/acervo/articles/article-1/file.pdf";

  assert.equal(isManagedPublicBlobUrl(managedUrl), true);
  assert.equal(isManagedPublicBlobUrl("https://example.com/acervo/articles/article-1/file.pdf"), false);
  assert.equal(isManagedPublicBlobUrl("https://store.public.blob.vercel-storage.com/outro/file.pdf"), false);

  assert.equal(await removePublicBlob(managedUrl, { client, token: "token-de-teste" }), true);
  assert.equal(
    await removePublicBlob("https://example.com/acervo/articles/article-1/file.pdf", {
      client,
      token: "token-de-teste",
    }),
    false,
  );
  assert.deepEqual(removals, [{ url: managedUrl, options: { token: "token-de-teste" } }]);
});
