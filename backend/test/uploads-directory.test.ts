import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveUploadsDirectory } from "../src/lib/uploads-directory.js";

test("uses the local uploads folder by default", () => {
  assert.equal(resolveUploadsDirectory(undefined, "/project/backend"), path.resolve("/project/backend", "uploads"));
});

test("supports an explicit persistent uploads directory", () => {
  assert.equal(resolveUploadsDirectory("/var/data", "/project/backend"), path.resolve("/var/data"));
});
