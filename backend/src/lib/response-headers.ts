import type { FastifyReply, FastifyRequest } from "fastify";

const publicApiCacheControl = "public, max-age=60, stale-while-revalidate=300";
const privateApiCacheControl = "no-store";
const sensitivePathPrefixes = ["/auth", "/reports", "/users"];

function hasHeader(reply: FastifyReply, name: string) {
  return typeof reply.hasHeader === "function" ? reply.hasHeader(name) : reply.getHeader(name) !== undefined;
}

function hasAuthorizationHeader(req: FastifyRequest) {
  const authorization = req.headers.authorization;
  return Array.isArray(authorization) ? authorization.length > 0 : Boolean(authorization);
}

function getPathname(url: string) {
  return url.split("?")[0] || "/";
}

function isSensitivePath(url: string) {
  const pathname = getPathname(url);
  return sensitivePathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getDefaultCacheControl(req: FastifyRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") return privateApiCacheControl;
  if (hasAuthorizationHeader(req) || isSensitivePath(req.url)) return privateApiCacheControl;
  return publicApiCacheControl;
}

export function applyDefaultResponseHeaders(req: FastifyRequest, reply: FastifyReply) {
  if (!hasHeader(reply, "X-Content-Type-Options")) {
    reply.header("X-Content-Type-Options", "nosniff");
  }

  if (!hasHeader(reply, "Cache-Control")) {
    reply.header("Cache-Control", getDefaultCacheControl(req));
  }
}
