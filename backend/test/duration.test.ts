import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedDuration, parseDurationMs } from "../src/lib/duration.js";

test("parses supported authentication durations", () => {
  assert.equal(parseDurationMs("30m"), 30 * 60_000);
  assert.equal(parseDurationMs("12h"), 12 * 60 * 60_000);
  assert.equal(parseDurationMs("7d"), 7 * 24 * 60 * 60_000);
});

test("rejects unsupported or unsafe authentication durations", () => {
  assert.equal(isSupportedDuration("12 hours"), false);
  assert.equal(isSupportedDuration("0m"), false);
  assert.throws(() => parseDurationMs("-1h"), /Duração inválida/);
});
