import assert from "node:assert/strict";
import test from "node:test";
import {
  getRemovedEventRuleResources,
  parseStoredEventRules,
} from "../src/lib/event-rules.js";

test("preserves valid stored event rules when a legacy row is invalid", () => {
  assert.deepEqual(
    parseStoredEventRules([
      { title: "Edital", file: " https://example.com/edital.pdf " },
      { title: "Legado inválido", file: "javascript:alert(1)" },
    ]),
    [{ title: "Edital", file: "https://example.com/edital.pdf" }],
  );
});

test("identifies removed event rule resources item by item", () => {
  assert.deepEqual(
    getRemovedEventRuleResources(
      [
        { title: "Edital", file: "https://example.com/edital.pdf" },
        { title: "Template", file: "https://example.com/template.pptx" },
        { title: "Legado inválido", file: "arquivo-relativo.pdf" },
      ],
      [{ title: "Edital", file: "https://example.com/edital.pdf" }],
    ),
    ["https://example.com/template.pptx"],
  );
});
