import { isUsableExternalResourceUrl, isUsableResourceUrl } from "@/lib/file-links";

describe("isUsableResourceUrl", () => {
  it("accepts internal paths and HTTP resources", () => {
    expect(isUsableResourceUrl("/events/event-1/files/edital.pdf")).toBe(true);
    expect(isUsableResourceUrl("https://example.com/template.pptx")).toBe(true);
    expect(isUsableResourceUrl("http://localhost:10000/events/event-1/files/edital.pdf")).toBe(true);
  });

  it("rejects unsafe schemes, protocol-relative URLs and placeholders", () => {
    expect(isUsableResourceUrl("//example.com/edital.pdf")).toBe(false);
    expect(isUsableResourceUrl("/\\example.com/edital.pdf")).toBe(false);
    expect(isUsableResourceUrl("javascript:alert(1)")).toBe(false);
    expect(isUsableResourceUrl("data:text/html,conteudo")).toBe(false);
    expect(isUsableResourceUrl("https://usuario:senha@example.com/edital.pdf")).toBe(false);
    expect(isUsableResourceUrl("https://acervo.local/edital.pdf")).toBe(false);
  });

  it("distinguishes external HTTP resources from internal paths", () => {
    expect(isUsableExternalResourceUrl(" https://example.com/template.pptx ")).toBe(true);
    expect(isUsableExternalResourceUrl("/events/event-1/files/edital.pdf")).toBe(false);
  });
});
