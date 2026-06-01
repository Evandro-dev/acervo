import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCourseLookup, sanitizeCourseName, uniqueCourseNames } from "../src/modules/courses/courses.service.js";

test("normalizes course whitespace and removes duplicated names case-insensitively", () => {
  assert.equal(sanitizeCourseName("  Engenharia   de Software  "), "Engenharia de Software");
  assert.deepEqual(uniqueCourseNames(["Direito", " direito ", "Administração", ""]), [
    "Direito",
    "Administração",
  ]);
});

test("normalizes course lookup values for stable filtering", () => {
  assert.equal(normalizeCourseLookup("  Engenharia   DE Software "), "engenharia de software");
});
