import assert from "node:assert/strict";
import test from "node:test";
import {
  extractLocalEventRuleFileName,
  getEventRuleResourceKey,
  isSafeEventRuleFileName,
} from "../src/lib/event-rule-files.js";
import { getRemovedEventRuleResources } from "../src/lib/event-rules.js";

test("recognizes only safe supported local rule filenames", () => {
  assert.equal(isSafeEventRuleFileName("1780355176739-edital-a1b2c3d4.pdf"), true);
  assert.equal(isSafeEventRuleFileName("1780355176739-template-a1b2c3d4.pptx"), true);
  assert.equal(isSafeEventRuleFileName("../edital.pdf"), false);
  assert.equal(isSafeEventRuleFileName("edital.exe"), false);
  assert.equal(isSafeEventRuleFileName("edital\r\nX-Test-injetado.pdf"), false);
});

test("uses canonical event-scoped resource keys for cleanup", () => {
  const localFileName = "1780355176739-template-a1b2c3d4.pptx";
  const managedBlobUrl =
    "https://store.public.blob.vercel-storage.com/acervo/events/event-1/rules/1780355176739-template-a1b2c3d4.pptx";

  assert.equal(
    getEventRuleResourceKey("event-1", `https://api.example.com/events/event-1/files/${localFileName}`),
    `local:${localFileName}`,
  );
  assert.equal(
    getEventRuleResourceKey("event-1", `https://outro-host.example/events/event-1/files/${localFileName}`),
    `local:${localFileName}`,
  );
  assert.equal(
    getEventRuleResourceKey("event-1", managedBlobUrl),
    "blob:/acervo/events/event-1/rules/1780355176739-template-a1b2c3d4.pptx",
  );
  assert.equal(getEventRuleResourceKey("event-2", managedBlobUrl), null);
  assert.equal(
    extractLocalEventRuleFileName("event-1", "https://api.example.com/events/event-1/files/../secret.pdf"),
    null,
  );
});

test("keeps a local event rule file when only its host changes", () => {
  const fileName = "1780355176739-template-a1b2c3d4.pptx";

  assert.deepEqual(
    getRemovedEventRuleResources(
      [{ title: "Template", file: `https://api-antiga.example/events/event-1/files/${fileName}` }],
      [{ title: "Template", file: `https://api-nova.example/events/event-1/files/${fileName}` }],
      (resourceUrl) => getEventRuleResourceKey("event-1", resourceUrl),
    ),
    [],
  );
});
