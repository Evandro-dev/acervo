import assert from "node:assert/strict";
import test from "node:test";
import {
  eventTypeSchema,
  normalizeEventType,
} from "../src/lib/contracts.js";
import { serializeEvent } from "../src/lib/serializers.js";

test("normalizes legacy and unaccented event type values", () => {
  assert.equal(normalizeEventType("Simp\u00c3\u00b3sio"), "Simpósio");
  assert.equal(normalizeEventType("Simposio"), "Simpósio");
  assert.equal(normalizeEventType("Seminario"), "Seminário");
  assert.equal(eventTypeSchema.parse("Simp\u00c3\u00b3sio"), "Simpósio");
  assert.equal(eventTypeSchema.parse("workshop"), "Workshop");
});

test("serializes legacy event type values with the canonical label", () => {
  const event = serializeEvent(
    {
      id: "event-1",
      slug: "simposio-una",
      title: "Simpósio UNA",
      edition: "1ª Edição",
      year: 2026,
      date: "15 de junho de 2026",
      area: "Tecnologia",
      type: "Simp\u00c3\u00b3sio",
      viewCount: 0,
      coverUrl: null,
      presentation: "Apresentação pública do evento.",
      themes: [],
      committee: [],
      rules: [],
      previousEditions: [],
      contactEmail: "evento@ulife.com.br",
      contactPhone: null,
      isbn: null,
      doi: null,
      catalogText: null,
      catalogPdfUrl: null,
      catalogImageUrl: null,
      articles: [],
    },
    { includeArticles: false },
  );

  assert.equal(event.type, "Simpósio");
});
