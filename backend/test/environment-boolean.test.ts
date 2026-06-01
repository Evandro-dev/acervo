import assert from "node:assert/strict";
import test from "node:test";
import { environmentBooleanSchema } from "../src/lib/environment-boolean.js";

test("keeps security feature switches disabled by default", () => {
  assert.equal(environmentBooleanSchema.parse(undefined), false);
  assert.equal(environmentBooleanSchema.parse("false"), false);
  assert.equal(environmentBooleanSchema.parse("true"), true);
});

test("rejects ambiguous environment boolean values", () => {
  assert.throws(() => environmentBooleanSchema.parse("1"));
  assert.throws(() => environmentBooleanSchema.parse("yes"));
});
