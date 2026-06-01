import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldRevokeSessionsAfterAccessAccountUpdate,
  wouldRemoveLastActiveAdministrator,
} from "../src/modules/users/access-account-management.policy.js";

test("protects the last active administrator from demotion or deactivation", () => {
  assert.equal(
    wouldRemoveLastActiveAdministrator({
      targetIsActive: true,
      targetRole: "ADMIN",
      nextIsActive: false,
      nextRole: "ADMIN",
      activeAdministratorCount: 1,
    }),
    true,
  );
  assert.equal(
    wouldRemoveLastActiveAdministrator({
      targetIsActive: true,
      targetRole: "ADMIN",
      nextIsActive: true,
      nextRole: "COORDENADOR",
      activeAdministratorCount: 1,
    }),
    true,
  );
});

test("allows administrator changes when another active administrator remains", () => {
  assert.equal(
    wouldRemoveLastActiveAdministrator({
      targetIsActive: true,
      targetRole: "ADMIN",
      nextIsActive: false,
      nextRole: "ADMIN",
      activeAdministratorCount: 2,
    }),
    false,
  );
  assert.equal(
    wouldRemoveLastActiveAdministrator({
      targetIsActive: false,
      targetRole: "ADMIN",
      nextIsActive: false,
      nextRole: "COORDENADOR",
      activeAdministratorCount: 1,
    }),
    false,
  );
});

test("revokes sessions only when access credentials or privileges change", () => {
  assert.equal(shouldRevokeSessionsAfterAccessAccountUpdate(["name", "jobTitle"]), false);
  assert.equal(shouldRevokeSessionsAfterAccessAccountUpdate(["email"]), true);
  assert.equal(shouldRevokeSessionsAfterAccessAccountUpdate(["password"]), true);
  assert.equal(shouldRevokeSessionsAfterAccessAccountUpdate(["role"]), true);
});
