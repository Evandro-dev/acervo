import { del, put } from "@vercel/blob";
import { env } from "../env.js";

const managedBlobPathPrefix = "/acervo/";
const publicBlobHostSuffix = ".public.blob.vercel-storage.com";

type BlobUploadBody = Parameters<typeof put>[1];

export type PublicBlobClient = {
  put: (
    pathname: string,
    body: BlobUploadBody,
    options: {
      access: "public";
      addRandomSuffix: false;
      contentType: string;
      token: string;
    },
  ) => Promise<{ url: string }>;
  del: (url: string, options: { token: string }) => Promise<void>;
};

type PublicBlobDependencies = {
  client?: PublicBlobClient;
  token?: string | null;
};

const vercelBlobClient: PublicBlobClient = {
  put,
  del: (url, options) => del(url, options),
};

function resolveBlobToken(dependencies: PublicBlobDependencies) {
  const token = dependencies.token === undefined ? env.BLOB_READ_WRITE_TOKEN : dependencies.token;
  return token?.trim() || null;
}

export function isPublicBlobStorageConfigured(token = env.BLOB_READ_WRITE_TOKEN) {
  return Boolean(token?.trim());
}

export function isManagedPublicBlobUrl(resourceUrl?: string | null) {
  if (!resourceUrl) return false;

  try {
    const parsed = new URL(resourceUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(publicBlobHostSuffix) &&
      parsed.pathname.startsWith(managedBlobPathPrefix)
    );
  } catch {
    return false;
  }
}

export async function uploadPublicBlob(
  pathname: string,
  body: BlobUploadBody,
  contentType: string,
  dependencies: PublicBlobDependencies = {},
) {
  const token = resolveBlobToken(dependencies);
  if (!token) return null;

  const blob = await (dependencies.client ?? vercelBlobClient).put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    token,
  });

  return blob.url;
}

export async function removePublicBlob(resourceUrl?: string | null, dependencies: PublicBlobDependencies = {}) {
  if (!isManagedPublicBlobUrl(resourceUrl)) return false;

  const token = resolveBlobToken(dependencies);
  if (!token) return false;

  await (dependencies.client ?? vercelBlobClient).del(resourceUrl!, { token });
  return true;
}
