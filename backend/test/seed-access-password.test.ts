import assert from "node:assert/strict";
import test from "node:test";
import {
  requireAdminBootstrapPassword,
  requireSeedAccessPassword,
} from "../src/lib/initial-access-password.js";

test("requires an explicit seed password with at least 12 characters, a letter and a number", () => {
  assert.equal(requireSeedAccessPassword("senha-local-segura-2026"), "senha-local-segura-2026");
  assert.throws(() => requireSeedAccessPassword(), /SEED_ACCESS_PASSWORD/);
  assert.throws(() => requireSeedAccessPassword("curta"), /pelo menos 12 caracteres/);
  assert.throws(() => requireSeedAccessPassword("senha-local-sem-numero"), /incluindo letra e número/);
});

test("requires an explicit password before provisioning the initial administrator", () => {
  assert.equal(requireAdminBootstrapPassword("admin-seguro-2026"), "admin-seguro-2026");
  assert.throws(() => requireAdminBootstrapPassword(), /ADMIN_BOOTSTRAP_PASSWORD/);
});
