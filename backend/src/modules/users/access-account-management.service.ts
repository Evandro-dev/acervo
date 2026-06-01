import bcrypt from "bcryptjs";
import type { Prisma } from "../../generated/prisma/client.js";
import { normalizeEmailAddress } from "../../lib/institutional-email.js";
import { isPrismaUniqueConstraintError } from "../../lib/prisma-errors.js";
import { prisma } from "../../lib/prisma.js";
import { revokeActiveAuthSessionsForUser } from "../auth/auth-session.service.js";
import { clearAccountLoginFailuresForEmails } from "../auth/login-throttle.service.js";
import {
  shouldRevokeSessionsAfterAccessAccountUpdate,
  wouldRemoveLastActiveAdministrator,
  type ManagedAccessAccountField,
} from "./access-account-management.policy.js";

type AccessAccountRole = "ADMIN" | "COORDENADOR";

type PrismaTransactionHost = {
  $transaction<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

type CreateAccessAccountInput = {
  name: string;
  email: string;
  password: string;
  role: AccessAccountRole;
  jobTitle?: string;
  bio?: string;
  area?: string;
  avatarUrl?: string;
};

type UpdateAccessAccountInput = {
  name?: string;
  email?: string;
  password?: string;
  role?: AccessAccountRole;
  jobTitle?: string | null;
};

export const managedAccessAccountSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  jobTitle: true,
  bio: true,
  area: true,
  avatarUrl: true,
  isActive: true,
  deactivatedAt: true,
} as const;

export class AccessAccountManagementError extends Error {
  constructor(
    public readonly code:
      | "ACCOUNT_EXISTS"
      | "ACCOUNT_NOT_FOUND"
      | "SELF_DEACTIVATION_FORBIDDEN"
      | "LAST_ACTIVE_ADMIN_REQUIRED",
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AccessAccountManagementError";
  }
}

async function lockActiveAdministratorSet(transaction: Prisma.TransactionClient) {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('access-account:active-administrators'))::text`;
}

async function lockAccessAccount(transaction: Prisma.TransactionClient, userId: string) {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`access-account:${userId}`}))::text`;
}

async function findAccessAccountOrThrow(transaction: Prisma.TransactionClient, userId: string) {
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: managedAccessAccountSelect,
  });

  if (!user) {
    throw new AccessAccountManagementError("ACCOUNT_NOT_FOUND", "Conta de acesso não encontrada.", 404);
  }

  return user;
}

async function assertActiveAdministratorRemains(
  transaction: Prisma.TransactionClient,
  target: { isActive: boolean; role: string },
  next: { isActive: boolean; role: string },
) {
  if (!(target.isActive && target.role === "ADMIN") || (next.isActive && next.role === "ADMIN")) return;

  await lockActiveAdministratorSet(transaction);
  const activeAdministratorCount = await transaction.user.count({
    where: { isActive: true, role: "ADMIN" },
  });

  if (
    wouldRemoveLastActiveAdministrator({
      targetIsActive: target.isActive,
      targetRole: target.role,
      nextIsActive: next.isActive,
      nextRole: next.role,
      activeAdministratorCount,
    })
  ) {
    throw new AccessAccountManagementError(
      "LAST_ACTIVE_ADMIN_REQUIRED",
      "Mantenha ao menos um administrador ativo para gerenciar os acessos.",
      409,
    );
  }
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    targetUserId: string;
    action: "CREATED" | "UPDATED" | "DEACTIVATED" | "REACTIVATED";
    changedFields: string[];
  },
) {
  await transaction.accessAccountAudit.create({ data: input });
}

function normalizeNullableText(value?: string | null) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

function changedFieldsForUpdate(
  current: {
    name: string;
    email: string;
    role: string;
    jobTitle: string | null;
  },
  input: UpdateAccessAccountInput,
  normalizedEmail: string | undefined,
  normalizedJobTitle: string | null | undefined,
) {
  const changedFields: ManagedAccessAccountField[] = [];

  if (input.name !== undefined && input.name !== current.name) changedFields.push("name");
  if (normalizedEmail !== undefined && normalizedEmail !== current.email) changedFields.push("email");
  if (input.role !== undefined && input.role !== current.role) changedFields.push("role");
  if (normalizedJobTitle !== undefined && normalizedJobTitle !== current.jobTitle) changedFields.push("jobTitle");
  if (input.password !== undefined) changedFields.push("password");

  return changedFields;
}

export async function createManagedAccessAccount(
  actorUserId: string,
  input: CreateAccessAccountInput,
  database: PrismaTransactionHost = prisma,
) {
  const email = normalizeEmailAddress(input.email);
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    return await database.$transaction(async (transaction: Prisma.TransactionClient) => {
      const user = await transaction.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role: input.role,
          jobTitle: input.jobTitle,
          bio: input.bio,
          area: input.area,
          avatarUrl: input.avatarUrl,
        },
        select: managedAccessAccountSelect,
      });
      const changedFields = ["name", "email", "password", "role", ...(input.jobTitle ? ["jobTitle"] : [])];

      await recordAudit(transaction, {
        actorUserId,
        targetUserId: user.id,
        action: "CREATED",
        changedFields,
      });

      return { user, changedFields, revokedSessionCount: 0 };
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AccessAccountManagementError("ACCOUNT_EXISTS", "Já existe uma conta com este e-mail.", 409);
    }

    throw error;
  }
}

export async function updateManagedAccessAccount(
  actorUserId: string,
  targetUserId: string,
  input: UpdateAccessAccountInput,
  database: PrismaTransactionHost = prisma,
) {
  const passwordHash = input.password === undefined ? undefined : await bcrypt.hash(input.password, 10);

  try {
    return await database.$transaction(async (transaction: Prisma.TransactionClient) => {
      await lockAccessAccount(transaction, targetUserId);
      const current = await findAccessAccountOrThrow(transaction, targetUserId);
      const email = input.email === undefined ? undefined : normalizeEmailAddress(input.email);
      const jobTitle = normalizeNullableText(input.jobTitle);
      const changedFields = changedFieldsForUpdate(current, input, email, jobTitle);

      if (!changedFields.length) return { user: current, changedFields, revokedSessionCount: 0 };

      const nextRole = input.role ?? current.role;
      await assertActiveAdministratorRemains(transaction, current, {
        isActive: current.isActive,
        role: nextRole,
      });

      const user = await transaction.user.update({
        where: { id: targetUserId },
        data: {
          name: input.name,
          email,
          role: input.role,
          jobTitle,
          passwordHash,
        },
        select: managedAccessAccountSelect,
      });

      let revokedSessionCount = 0;
      if (shouldRevokeSessionsAfterAccessAccountUpdate(changedFields)) {
        const revoked = await revokeActiveAuthSessionsForUser(transaction, targetUserId, "ADMIN_ACCOUNT_UPDATED");
        revokedSessionCount = revoked.count;
      }

      if (changedFields.includes("email") || changedFields.includes("password")) {
        await clearAccountLoginFailuresForEmails(transaction, [current.email, user.email]);
      }

      await recordAudit(transaction, {
        actorUserId,
        targetUserId,
        action: "UPDATED",
        changedFields,
      });

      return { user, changedFields, revokedSessionCount };
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AccessAccountManagementError("ACCOUNT_EXISTS", "Já existe uma conta com este e-mail.", 409);
    }

    throw error;
  }
}

export async function deactivateManagedAccessAccount(
  actorUserId: string,
  targetUserId: string,
  database: PrismaTransactionHost = prisma,
) {
  if (actorUserId === targetUserId) {
    throw new AccessAccountManagementError(
      "SELF_DEACTIVATION_FORBIDDEN",
      "Você não pode desativar a própria conta.",
      409,
    );
  }

  return database.$transaction(async (transaction: Prisma.TransactionClient) => {
    await lockAccessAccount(transaction, targetUserId);
    const current = await findAccessAccountOrThrow(transaction, targetUserId);
    if (!current.isActive) return { user: current, changedFields: [], revokedSessionCount: 0 };

    await assertActiveAdministratorRemains(transaction, current, {
      isActive: false,
      role: current.role,
    });

    const user = await transaction.user.update({
      where: { id: targetUserId },
      data: { isActive: false, deactivatedAt: new Date() },
      select: managedAccessAccountSelect,
    });
    const revoked = await revokeActiveAuthSessionsForUser(transaction, targetUserId, "ACCOUNT_DEACTIVATED");
    await clearAccountLoginFailuresForEmails(transaction, [current.email]);
    await recordAudit(transaction, {
      actorUserId,
      targetUserId,
      action: "DEACTIVATED",
      changedFields: ["isActive"],
    });

    return { user, changedFields: ["isActive"], revokedSessionCount: revoked.count };
  });
}

export async function reactivateManagedAccessAccount(
  actorUserId: string,
  targetUserId: string,
  database: PrismaTransactionHost = prisma,
) {
  return database.$transaction(async (transaction: Prisma.TransactionClient) => {
    await lockAccessAccount(transaction, targetUserId);
    const current = await findAccessAccountOrThrow(transaction, targetUserId);
    if (current.isActive) return { user: current, changedFields: [], revokedSessionCount: 0 };

    const user = await transaction.user.update({
      where: { id: targetUserId },
      data: { isActive: true, deactivatedAt: null },
      select: managedAccessAccountSelect,
    });
    await clearAccountLoginFailuresForEmails(transaction, [current.email]);
    await recordAudit(transaction, {
      actorUserId,
      targetUserId,
      action: "REACTIVATED",
      changedFields: ["isActive"],
    });

    return { user, changedFields: ["isActive"], revokedSessionCount: 0 };
  });
}
