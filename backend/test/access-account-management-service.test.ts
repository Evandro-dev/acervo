import assert from "node:assert/strict";
import test from "node:test";

type FakeUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "COORDENADOR";
  jobTitle: string | null;
  bio: string | null;
  area: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  deactivatedAt: Date | null;
};

function createFakeDatabase(initialUser: FakeUser, activeAdministratorCount = 1) {
  let user = { ...initialUser };
  const audits: Record<string, unknown>[] = [];
  const revokedSessions: Record<string, unknown>[] = [];
  const deletedThrottleFilters: Record<string, unknown>[] = [];
  let transactionCount = 0;

  const transaction = {
    $queryRaw: async () => [],
    user: {
      findUnique: async () => ({ ...user }),
      count: async () => activeAdministratorCount,
      update: async ({ data }: { data: Partial<FakeUser> }) => {
        user = { ...user, ...data };
        return { ...user };
      },
    },
    authSession: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        revokedSessions.push(data);
        return { count: 1 };
      },
    },
    loginThrottle: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        deletedThrottleFilters.push(where);
        return { count: 0 };
      },
    },
    accessAccountAudit: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      },
    },
  };

  return {
    database: {
      $transaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => {
        transactionCount += 1;
        return callback(transaction);
      },
    },
    getState: () => ({ audits, deletedThrottleFilters, revokedSessions, transactionCount, user }),
  };
}

const admin: FakeUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@ulife.com.br",
  role: "ADMIN",
  jobTitle: "Professor",
  bio: null,
  area: null,
  avatarUrl: null,
  isActive: true,
  deactivatedAt: null,
};

test("prevents self-deactivation before opening a transaction", async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";
  process.env.JWT_SECRET ??= "test-only-jwt-secret";
  const { AccessAccountManagementError, deactivateManagedAccessAccount } = await import(
    "../src/modules/users/access-account-management.service.js"
  );
  const fake = createFakeDatabase(admin);

  await assert.rejects(
    deactivateManagedAccessAccount(admin.id, admin.id, fake.database as never),
    (error) => error instanceof AccessAccountManagementError && error.code === "SELF_DEACTIVATION_FORBIDDEN",
  );
  assert.equal(fake.getState().transactionCount, 0);
});

test("prevents deactivation of the last active administrator", async () => {
  const { AccessAccountManagementError, deactivateManagedAccessAccount } = await import(
    "../src/modules/users/access-account-management.service.js"
  );
  const fake = createFakeDatabase(admin, 1);

  await assert.rejects(
    deactivateManagedAccessAccount("admin-2", admin.id, fake.database as never),
    (error) => error instanceof AccessAccountManagementError && error.code === "LAST_ACTIVE_ADMIN_REQUIRED",
  );
  assert.equal(fake.getState().user.isActive, true);
  assert.equal(fake.getState().audits.length, 0);
});

test("deactivates an account, revokes its sessions and records an audit entry", async () => {
  const { deactivateManagedAccessAccount } = await import("../src/modules/users/access-account-management.service.js");
  const coordinator = { ...admin, id: "coord-1", role: "COORDENADOR" as const };
  const fake = createFakeDatabase(coordinator);

  const result = await deactivateManagedAccessAccount("admin-1", coordinator.id, fake.database as never);
  const state = fake.getState();

  assert.equal(result.user.isActive, false);
  assert.equal(state.revokedSessions.length, 1);
  assert.equal(state.revokedSessions[0].revocationReason, "ACCOUNT_DEACTIVATED");
  assert.equal(state.deletedThrottleFilters.length, 1);
  assert.deepEqual(state.audits[0], {
    actorUserId: "admin-1",
    targetUserId: "coord-1",
    action: "DEACTIVATED",
    changedFields: ["isActive"],
  });
});

test("revokes sessions and audits an administrative email update", async () => {
  const { updateManagedAccessAccount } = await import("../src/modules/users/access-account-management.service.js");
  const coordinator = { ...admin, id: "coord-1", role: "COORDENADOR" as const };
  const fake = createFakeDatabase(coordinator);

  const result = await updateManagedAccessAccount(
    "admin-1",
    coordinator.id,
    { email: " NOVO@ULIFE.COM.BR " },
    fake.database as never,
  );
  const state = fake.getState();

  assert.equal(result.user.email, "novo@ulife.com.br");
  assert.deepEqual(result.changedFields, ["email"]);
  assert.equal(state.revokedSessions[0].revocationReason, "ADMIN_ACCOUNT_UPDATED");
  assert.equal(state.deletedThrottleFilters.length, 1);
  assert.deepEqual(state.audits[0], {
    actorUserId: "admin-1",
    targetUserId: "coord-1",
    action: "UPDATED",
    changedFields: ["email"],
  });
});

test("reactivates an account without deleting its history", async () => {
  const { reactivateManagedAccessAccount } = await import("../src/modules/users/access-account-management.service.js");
  const coordinator = {
    ...admin,
    id: "coord-1",
    role: "COORDENADOR" as const,
    isActive: false,
    deactivatedAt: new Date("2026-06-01T12:00:00.000Z"),
  };
  const fake = createFakeDatabase(coordinator);

  const result = await reactivateManagedAccessAccount("admin-1", coordinator.id, fake.database as never);

  assert.equal(result.user.isActive, true);
  assert.equal(result.user.deactivatedAt, null);
  assert.deepEqual(fake.getState().audits[0], {
    actorUserId: "admin-1",
    targetUserId: "coord-1",
    action: "REACTIVATED",
    changedFields: ["isActive"],
  });
});
