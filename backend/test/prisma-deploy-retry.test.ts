import assert from "node:assert/strict";
import test from "node:test";
import { isPrismaAdvisoryLockTimeout, runPrismaDeployWithRetry } from "../scripts/prisma-deploy-retry.mjs";

function advisoryLockTimeout() {
  const error = new Error("Command failed: npm run prisma:deploy");
  (error as Error & { output: string }).output = `
Error: P1002
Context: Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).
`;
  return error;
}

test("recognizes Prisma advisory lock timeouts as transient", () => {
  assert.equal(isPrismaAdvisoryLockTimeout(advisoryLockTimeout()), true);
  assert.equal(isPrismaAdvisoryLockTimeout(new Error("Error: P1002 database connection timeout")), false);
});

test("retries transient Prisma advisory lock timeouts with bounded delays", async () => {
  let attemptCount = 0;
  const delays: number[] = [];

  await runPrismaDeployWithRetry(
    async () => {
      attemptCount += 1;
      if (attemptCount < 3) throw advisoryLockTimeout();
    },
    {
      retryDelaysMs: [10, 20],
      wait: async (delayMs: number) => {
        delays.push(delayMs);
      },
      warn: () => {},
    },
  );

  assert.equal(attemptCount, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("does not hide unrelated Prisma deployment failures", async () => {
  const error = new Error("Migration SQL failed");
  let attemptCount = 0;

  await assert.rejects(
    runPrismaDeployWithRetry(
      async () => {
        attemptCount += 1;
        throw error;
      },
      { wait: async () => {}, warn: () => {} },
    ),
    error,
  );
  assert.equal(attemptCount, 1);
});

test("stops retrying after the configured Prisma advisory lock attempts", async () => {
  let attemptCount = 0;

  await assert.rejects(
    runPrismaDeployWithRetry(
      async () => {
        attemptCount += 1;
        throw advisoryLockTimeout();
      },
      {
        retryDelaysMs: [10, 20],
        wait: async () => {},
        warn: () => {},
      },
    ),
    /Command failed: npm run prisma:deploy/,
  );
  assert.equal(attemptCount, 3);
});
