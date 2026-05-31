import assert from "node:assert/strict";
import test from "node:test";
import { getLoginThrottleSubjects } from "../src/modules/auth/login-throttle-identifiers.js";

test("uses the same normalized account subject even when the source IP changes", () => {
  const firstAttempt = getLoginThrottleSubjects(" Toninho@ULIFE.COM.BR ", "192.0.2.10");
  const secondAttempt = getLoginThrottleSubjects("toninho@ulife.com.br", "198.51.100.20");

  assert.equal(firstAttempt.account, "toninho@ulife.com.br");
  assert.equal(secondAttempt.account, firstAttempt.account);
  assert.notEqual(secondAttempt.ip, firstAttempt.ip);
});
