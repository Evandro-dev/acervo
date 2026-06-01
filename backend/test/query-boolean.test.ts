import assert from "node:assert/strict";
import test from "node:test";
import { queryBooleanSchema } from "../src/lib/query-boolean.js";

test("parses explicit boolean query values without treating false as truthy", () => {
  assert.equal(queryBooleanSchema.parse(undefined), false);
  assert.equal(queryBooleanSchema.parse(false), false);
  assert.equal(queryBooleanSchema.parse("false"), false);
  assert.equal(queryBooleanSchema.parse(true), true);
  assert.equal(queryBooleanSchema.parse("true"), true);
});

test("rejects ambiguous boolean query values", () => {
  assert.throws(() => queryBooleanSchema.parse("0"));
  assert.throws(() => queryBooleanSchema.parse("1"));
  assert.throws(() => queryBooleanSchema.parse("yes"));
});
