import assert from "node:assert/strict";
import test from "node:test";
import { canAuthenticateAccessAccount } from "../src/modules/auth/access-account-login.policy.js";

test("authenticates only an active account with a matching password", () => {
  assert.equal(canAuthenticateAccessAccount({ isActive: true }, true), true);
  assert.equal(canAuthenticateAccessAccount({ isActive: true }, false), false);
  assert.equal(canAuthenticateAccessAccount({ isActive: false }, true), false);
  assert.equal(canAuthenticateAccessAccount(null, true), false);
});
