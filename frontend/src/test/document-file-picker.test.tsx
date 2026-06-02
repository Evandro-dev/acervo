import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentFilePicker } from "@/components/admin/DocumentFilePicker";
import { eventRuleDocumentAccept } from "@/lib/event-rule-documents";

describe("DocumentFilePicker", () => {
  it("supports the rule document profile and exposes generic replacement actions", () => {
    const onFilesChange = vi.fn();
    const onRemove = vi.fn();
    const selectedFile = new File(["slides"], "template-apresentacao.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const { container } = render(
      <DocumentFilePicker
        accept={eventRuleDocumentAccept}
        title="Selecionar arquivo da norma"
        description="Envie um documento."
        selectedFile={selectedFile}
        onFilesChange={onFilesChange}
        onRemove={onRemove}
      />,
    );

    expect(container.querySelector('input[type="file"]')).toHaveAttribute("accept", expect.stringContaining(".pptx"));
    expect(screen.getByText("template-apresentacao.pptx")).toBeInTheDocument();
    expect(screen.getByText("Trocar arquivo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover arquivo selecionado" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
