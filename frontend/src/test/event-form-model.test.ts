import {
  emptyForm,
  mapEventToForm,
  validateAndPrepare,
  type FormState,
} from "@/features/acervo/event-form-model";
import { normalizeEventType, type Event } from "@/types/acervo";

function buildForm(patch: Partial<FormState> = {}): FormState {
  return {
    ...emptyForm(),
    title: "Simpósio UNA",
    edition: "1ª Edição",
    year: 2026,
    date: "15 de junho de 2026",
    area: "Tecnologia",
    presentation: "Apresentação pública do evento.",
    contactEmail: "evento@ulife.com.br",
    ...patch,
  };
}

describe("event type normalization", () => {
  it("normalizes legacy and unaccented event type values", () => {
    expect(normalizeEventType("Simp\u00c3\u00b3sio")).toBe("Simpósio");
    expect(normalizeEventType("Simposio")).toBe("Simpósio");
    expect(normalizeEventType("Seminario")).toBe("Seminário");
    expect(normalizeEventType("expo")).toBe("Expo");
  });

  it("maps legacy event types to a valid select value when editing an event", () => {
    const form = mapEventToForm({
      id: "event-1",
      slug: "simposio-una",
      title: "Simpósio UNA",
      edition: "1ª Edição",
      year: 2026,
      date: "15 de junho de 2026",
      area: "Tecnologia",
      type: "Simp\u00c3\u00b3sio",
      presentation: "Apresentação pública do evento.",
      themes: [],
      committee: [],
      catalog: {},
      rules: [],
      previousEditions: [],
      contact: { email: "evento@ulife.com.br" },
      articleCount: 0,
      publishedCount: 0,
      draftCount: 0,
      archivedCount: 0,
      articles: [],
    } as Event);

    expect(form.type).toBe("Simpósio");
  });

  it("sends the canonical event type in create and update payloads", () => {
    const prepared = validateAndPrepare(
      buildForm({
        type: "Seminario" as FormState["type"],
      }),
    );

    expect(prepared.payload.type).toBe("Seminário");
  });
});
