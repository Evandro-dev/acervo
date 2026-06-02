import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrismaTransactionExpiredError,
  isPrismaUniqueConstraintError,
} from "../src/lib/prisma-errors.js";

test("recognizes Prisma unique constraint conflicts without masking unrelated failures", () => {
  assert.equal(isPrismaUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(isPrismaUniqueConstraintError({ code: "P2025" }), false);
  assert.equal(isPrismaUniqueConstraintError(new Error("database offline")), false);
});

test("recognizes Prisma interactive transaction expiration errors", () => {
  assert.equal(isPrismaTransactionExpiredError({ code: "P2028" }), true);
  assert.equal(isPrismaTransactionExpiredError({ code: "P2002" }), false);
  assert.equal(isPrismaTransactionExpiredError(new Error("P2028")), false);
});
