import assert from "node:assert/strict";
import test from "node:test";
import { institutionalAreas, institutionalCourses } from "../prisma/institutional-catalog-data.js";
import { normalizeCourseLookup } from "../src/modules/courses/courses.service.js";

test("keeps the institutional catalog normalized and free from duplicate entries", () => {
  assert.equal(new Set(institutionalAreas.map((area) => area.toLocaleLowerCase())).size, institutionalAreas.length);
  assert.equal(new Set(institutionalCourses.map(normalizeCourseLookup)).size, institutionalCourses.length);
});

test("stores course names rather than pasted grouping labels", () => {
  assert.equal(institutionalAreas.includes("Saúde"), true);
  assert.equal(institutionalAreas.includes("Ciências Agrárias"), true);
  assert.equal(institutionalCourses.includes("Saúde" as never), false);
  assert.equal(institutionalCourses.includes("Agrárias" as never), false);
  assert.equal(institutionalCourses.includes("Agronomia"), true);
  assert.equal(institutionalCourses.includes("Medicina Veterinária"), true);
  assert.equal(institutionalCourses.includes("Estética"), true);
});
