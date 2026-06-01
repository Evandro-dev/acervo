import assert from "node:assert/strict";
import test from "node:test";
import { isPrismaUniqueConstraintError } from "../src/lib/prisma-errors.js";

test("recognizes Prisma unique constraint conflicts without masking unrelated failures", () => {
  assert.equal(isPrismaUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(isPrismaUniqueConstraintError({ code: "P2025" }), false);
  assert.equal(isPrismaUniqueConstraintError(new Error("database offline")), false);
});
