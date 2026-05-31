import { env } from "../../env.js";
import { parseDurationMs } from "../../lib/duration.js";
import { prisma } from "../../lib/prisma.js";
import { createAuthFingerprint } from "./auth-fingerprint.js";
import { isAuthSessionExpired, shouldRefreshAuthSessionActivity } from "./auth-session.policy.js";

const SESSION_ACTIVITY_REFRESH_MS = 60_000;
const SESSION_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60_000;

type SessionRevocationReason = "LOGOUT" | "SIGNED_IN_ELSEWHERE" | "EXPIRED";

export type ActiveSessionUser = {
  sub: string;
  sid: string;
  role: string;
  name: string;
};

export class AuthSessionError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "SESSION_REVOKED" | "SESSION_EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "AuthSessionError";
  }
}

function getSessionAbsoluteExpiration(now: Date) {
  return new Date(now.getTime() + parseDurationMs(env.JWT_EXPIRES_IN));
}

function normalizeUserAgent(userAgent?: string) {
  const normalized = userAgent?.trim();
  return normalized ? normalized.slice(0, 300) : undefined;
}

async function lockUserSessions(transaction: typeof prisma, userId: string) {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`auth-session:${userId}`}))::text`;
}

async function revokeSessionIfActive(sessionId: string, reason: SessionRevocationReason, revokedAt: Date) {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt, revocationReason: reason },
  });
}

export async function createExclusiveAuthSession(input: {
  userId: string;
  ip: string;
  userAgent?: string;
}) {
  const now = new Date();
  const expiredHistoryCutoff = new Date(now.getTime() - SESSION_HISTORY_RETENTION_MS);

  return prisma.$transaction(async (transaction: typeof prisma) => {
    await lockUserSessions(transaction, input.userId);

    const revokedSessions = await transaction.authSession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: now, revocationReason: "SIGNED_IN_ELSEWHERE" },
    });

    await transaction.authSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: expiredHistoryCutoff } },
          { revokedAt: { lte: expiredHistoryCutoff } },
        ],
        userId: input.userId,
      },
    });

    const session = await transaction.authSession.create({
      data: {
        userId: input.userId,
        expiresAt: getSessionAbsoluteExpiration(now),
        ipHash: createAuthFingerprint("session-ip", input.ip),
        userAgent: normalizeUserAgent(input.userAgent),
      },
      select: { id: true },
    });

    return {
      id: session.id,
      revokedSessionCount: revokedSessions.count,
    };
  });
}

export async function validateAuthSession(sessionId: string, userId: string): Promise<ActiveSessionUser> {
  if (!sessionId || !userId) {
    throw new AuthSessionError("UNAUTHENTICATED", "Não autenticado");
  }

  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
      revocationReason: true,
      user: {
        select: {
          id: true,
          role: true,
          name: true,
        },
      },
    },
  });

  if (!session || session.userId !== userId) {
    throw new AuthSessionError("UNAUTHENTICATED", "Não autenticado");
  }

  if (session.revokedAt) {
    const signedInElsewhere = session.revocationReason === "SIGNED_IN_ELSEWHERE";
    throw new AuthSessionError(
      signedInElsewhere ? "SESSION_REVOKED" : "UNAUTHENTICATED",
      signedInElsewhere
        ? "Sua sessão foi encerrada porque a conta foi acessada em outro dispositivo ou navegador."
        : "Não autenticado",
    );
  }

  const now = new Date();
  if (
    isAuthSessionExpired({
      now,
      lastSeenAt: session.lastSeenAt,
      absoluteExpiresAt: session.expiresAt,
      idleTimeoutMs: env.AUTH_SESSION_IDLE_TIMEOUT_MINUTES * 60_000,
    })
  ) {
    await revokeSessionIfActive(session.id, "EXPIRED", now);
    throw new AuthSessionError("SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");
  }

  if (
    shouldRefreshAuthSessionActivity({
      now,
      lastSeenAt: session.lastSeenAt,
      refreshIntervalMs: SESSION_ACTIVITY_REFRESH_MS,
    })
  ) {
    await prisma.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt: now },
    });
  }

  return {
    sub: session.user.id,
    sid: session.id,
    role: session.user.role,
    name: session.user.name,
  };
}

export async function revokeAuthSession(sessionId: string) {
  await revokeSessionIfActive(sessionId, "LOGOUT", new Date());
}
