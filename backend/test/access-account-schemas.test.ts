import assert from "node:assert/strict";
import test from "node:test";
import { accessAccountPasswordSchema, accessAccountRoleSchema } from "../src/lib/access-account.schemas.js";

test("accepts only access account roles supported by the administrative panel", () => {
  assert.equal(accessAccountRoleSchema.parse("ADMIN"), "ADMIN");
  assert.equal(accessAccountRoleSchema.parse("COORDENADOR"), "COORDENADOR");
  assert.throws(() => accessAccountRoleSchema.parse("USER"));
});

test("requires a minimally robust access account password", () => {
  assert.equal(accessAccountPasswordSchema.parse("Senha2026"), "Senha2026");
  assert.throws(() => accessAccountPasswordSchema.parse("curta1"));
  assert.throws(() => accessAccountPasswordSchema.parse("somenteletras"));
  assert.throws(() => accessAccountPasswordSchema.parse("12345678"));
});
