import { describe, expect, it } from "vitest";
import { isStoredEventRuleFileUrl } from "@/lib/event-rule-file";

describe("isStoredEventRuleFileUrl", () => {
  it("recognizes API and Vercel Blob URLs created by the Acervo", () => {
    expect(isStoredEventRuleFileUrl("/events/event-1/files/norma.pdf")).toBe(true);
    expect(isStoredEventRuleFileUrl("https://api.example.com/events/event-1/files/norma.pdf")).toBe(true);
    expect(
      isStoredEventRuleFileUrl(
        "https://store.public.blob.vercel-storage.com/acervo/events/event-1/rules/norma.pdf",
      ),
    ).toBe(true);
  });

  it("keeps unrelated URLs classified as external links", () => {
    expect(isStoredEventRuleFileUrl("https://example.com/norma.pdf")).toBe(false);
    expect(isStoredEventRuleFileUrl("https://store.public.blob.vercel-storage.com/outro/norma.pdf")).toBe(false);
  });
});
