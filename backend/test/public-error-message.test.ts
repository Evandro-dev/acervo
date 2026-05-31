import assert from "node:assert/strict";
import test from "node:test";
import { getPublicErrorMessage } from "../src/lib/public-error-message.js";

test("does not expose internal details from unexpected server errors", () => {
  const error = new Error("Raw query failed with database details");

  assert.equal(getPublicErrorMessage(error, 500), "Erro interno do servidor");
});

test("keeps actionable messages for expected client errors", () => {
  const error = new Error("Requisição inválida");

  assert.equal(getPublicErrorMessage(error, 400), "Requisição inválida");
});
