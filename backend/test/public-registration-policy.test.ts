import assert from "node:assert/strict";
import test from "node:test";
import { getPublicCoordinatorRegistrationRestriction } from "../src/modules/auth/public-registration.policy.js";

test("denies public coordinator registration when the feature is disabled", () => {
  assert.deepEqual(getPublicCoordinatorRegistrationRestriction(false), {
    code: "PUBLIC_REGISTRATION_DISABLED",
    error: "O cadastro público está desativado. Solicite seu acesso a um administrador.",
  });
});

test("allows the preserved public coordinator registration flow only when explicitly enabled", () => {
  assert.equal(getPublicCoordinatorRegistrationRestriction(true), null);
});
