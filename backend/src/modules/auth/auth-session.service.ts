import { env } from "../../env.js";
import { parseDurationMs } from "../../lib/duration.js";
import { prisma } from "../../lib/prisma.js";
import { createAuthFingerprint } from "./auth-fingerprint.js";
import { isAuthSessionExpired, shouldRefreshAuthSessionActivity } from "./auth-session.policy.js";

const SESSION_ACTIVITY_REFRESH_MS = 60_000;
const SESSION_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60_000;

export type SessionRevocationReason =
  | "LOGOUT"
  | "SIGNED_IN_ELSEWHERE"
  | "EXPIRED"
  | "ADMIN_ACCOUNT_UPDATED"
  | "ACCOUNT_DEACTIVATED";

export type ActiveSessionUser = {
  sub: string;
  sid: string;
  role: string;
  name: string;
};

export class AuthSessionError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "SESSION_REVOKED" | "SESSION_EXPIRED" | "ACCOUNT_DISABLED",
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

export async function revokeActiveAuthSessionsForUser(
  transaction: typeof prisma,
  userId: string,
  reason: SessionRevocationReason,
  revokedAt = new Date(),
) {
  await lockUserSessions(transaction, userId);

  return transaction.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt, revocationReason: reason },
  });
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
    const revokedSessions = await revokeActiveAuthSessionsForUser(
      transaction,
      input.userId,
      "SIGNED_IN_ELSEWHERE",
      now,
    );

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
          isActive: true,
        },
      },
    },
  });

  if (!session || session.userId !== userId) {
    throw new AuthSessionError("UNAUTHENTICATED", "Não autenticado");
  }

  if (session.revokedAt) {
    if (session.revocationReason === "ACCOUNT_DEACTIVATED") {
      throw new AuthSessionError("ACCOUNT_DISABLED", "Sua conta foi desativada. Procure um administrador.");
    }

    const signedInElsewhere = session.revocationReason === "SIGNED_IN_ELSEWHERE";
    const accountUpdated = session.revocationReason === "ADMIN_ACCOUNT_UPDATED";
    throw new AuthSessionError(
      signedInElsewhere || accountUpdated ? "SESSION_REVOKED" : "UNAUTHENTICATED",
      signedInElsewhere
        ? "Sua sessão foi encerrada porque a conta foi acessada em outro dispositivo ou navegador."
        : accountUpdated
          ? "Sua sessão foi encerrada porque seus dados de acesso foram atualizados."
          : "Não autenticado",
    );
  }

  if (!session.user.isActive) {
    throw new AuthSessionError("ACCOUNT_DISABLED", "Sua conta foi desativada. Procure um administrador.");
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
