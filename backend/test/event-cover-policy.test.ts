import assert from "node:assert/strict";
import test from "node:test";
import { resolveUpdatedEventCoverUrl } from "../src/modules/events/event-cover.policy.js";

test("preserves the current event cover when an update omits the field", () => {
  assert.equal(resolveUpdatedEventCoverUrl("https://example.com/current.png"), "https://example.com/current.png");
});

test("removes the current event cover when an update explicitly sends null", () => {
  assert.equal(resolveUpdatedEventCoverUrl("https://example.com/current.png", null), null);
});

test("replaces the current event cover when an update sends another URL", () => {
  assert.equal(
    resolveUpdatedEventCoverUrl("https://example.com/current.png", "https://example.com/new.png"),
    "https://example.com/new.png",
  );
});
