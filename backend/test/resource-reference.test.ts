import assert from "node:assert/strict";
import test from "node:test";
import { eventRuleSchema } from "../src/lib/contracts.js";
import { isSafeResourceReference } from "../src/lib/resource-reference.js";

test("accepts internal paths and HTTP resources for event rules", () => {
  assert.equal(isSafeResourceReference("/events/event-1/files/edital.pdf"), true);
  assert.equal(isSafeResourceReference("https://example.com/template.pptx"), true);
  assert.equal(isSafeResourceReference("http://localhost:10000/events/event-1/files/edital.pdf"), true);
  assert.equal(
    eventRuleSchema.parse({ title: "Edital", file: " https://example.com/edital.pdf " }).file,
    "https://example.com/edital.pdf",
  );
});

test("rejects unsafe event rule resource references", () => {
  assert.equal(isSafeResourceReference("//example.com/edital.pdf"), false);
  assert.equal(isSafeResourceReference("/\\example.com/edital.pdf"), false);
  assert.equal(isSafeResourceReference("javascript:alert(1)"), false);
  assert.equal(isSafeResourceReference("data:text/html,conteudo"), false);
  assert.equal(isSafeResourceReference("https://usuario:senha@example.com/edital.pdf"), false);
  assert.equal(isSafeResourceReference("edital.pdf"), false);
  assert.equal(eventRuleSchema.safeParse({ title: "Edital", file: "javascript:alert(1)" }).success, false);
});
