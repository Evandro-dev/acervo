import {
  getEventRuleDocumentExtension,
  getEventRuleDocumentLabel,
  isSupportedEventRuleDocument,
  removeEventRuleDocumentExtension,
} from "@/lib/event-rule-documents";

describe("event rule documents", () => {
  it("identifies the allowed rule document extensions and labels", () => {
    expect(getEventRuleDocumentExtension("https://example.com/template.pptx?download=1")).toBe(".pptx");
    expect(getEventRuleDocumentLabel("/events/event-1/files/regulamento.docx")).toBe("Word");
    expect(getEventRuleDocumentLabel("edital.pdf")).toBe("PDF");
    expect(getEventRuleDocumentLabel("arquivo.txt")).toBe("Arquivo");
  });

  it("allows only PDF, DOCX and PPTX filenames for rule documents", () => {
    expect(isSupportedEventRuleDocument({ name: "normas.pdf" })).toBe(true);
    expect(isSupportedEventRuleDocument({ name: "regulamento.docx" })).toBe(true);
    expect(isSupportedEventRuleDocument({ name: "template.pptx" })).toBe(true);
    expect(isSupportedEventRuleDocument({ name: "template.pptm" })).toBe(false);
    expect(removeEventRuleDocumentExtension("template.pptx")).toBe("template");
  });
});
