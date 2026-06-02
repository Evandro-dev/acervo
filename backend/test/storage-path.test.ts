import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeStorageResourceId,
  escapeRegExp,
  isSafeStorageFileName,
  isSafeStorageResourceId,
  truncateStorageFileSlug,
} from "../src/lib/storage-path.js";

test("accepts generated storage identifiers and rejects path traversal values", () => {
  assert.equal(isSafeStorageResourceId("cmby3r0ic0000abc123"), true);
  assert.equal(isSafeStorageResourceId("event-1"), true);
  assert.equal(isSafeStorageResourceId("../event"), false);
  assert.equal(isSafeStorageResourceId("event/../../secret"), false);
  assert.throws(() => assertSafeStorageResourceId(".."));
});

test("accepts generated filenames and rejects unsafe header or traversal characters", () => {
  assert.equal(isSafeStorageFileName("1780355176739-edital-a1b2c3d4.pdf"), true);
  assert.equal(isSafeStorageFileName("../edital.pdf"), false);
  assert.equal(isSafeStorageFileName("edital\r\nX-Test-injetado.pdf"), false);
  assert.equal(isSafeStorageFileName(`${"a".repeat(241)}.pdf`), false);
  assert.equal(escapeRegExp("event.1"), "event\\.1");
  assert.equal(truncateStorageFileSlug(`${"a".repeat(180)}-restante`), "a".repeat(180));
});
