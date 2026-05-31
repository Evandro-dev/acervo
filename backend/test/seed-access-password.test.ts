import assert from "node:assert/strict";
import test from "node:test";
import { requireSeedAccessPassword } from "../src/lib/seed-access-password.js";

test("requires an explicit seed password with at least 12 characters", () => {
  assert.equal(requireSeedAccessPassword("senha-local-segura"), "senha-local-segura");
  assert.throws(() => requireSeedAccessPassword(), /SEED_ACCESS_PASSWORD/);
  assert.throws(() => requireSeedAccessPassword("curta"), /pelo menos 12 caracteres/);
});
