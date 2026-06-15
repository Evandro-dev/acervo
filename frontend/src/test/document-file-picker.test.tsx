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

  it("shows a current persisted document with open, replace and remove actions", () => {
    const onFilesChange = vi.fn();
    const onRemoveCurrent = vi.fn();
    const { container } = render(
      <DocumentFilePicker
        accept={eventRuleDocumentAccept}
        title="Trocar arquivo da norma"
        description="Envie um documento."
        currentFile={{
          description: "Arquivo atual vinculado.",
          href: "http://localhost:10000/events/event-1/files/edital.pdf",
          name: "edital.pdf",
        }}
        currentRemoveAriaLabel="Remover arquivo atual da norma"
        onFilesChange={onFilesChange}
        onRemoveCurrent={onRemoveCurrent}
      />,
    );

    expect(screen.getByText("edital.pdf")).toBeInTheDocument();
    expect(screen.getByText("Arquivo atual vinculado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir/i })).toHaveAttribute(
      "href",
      "http://localhost:10000/events/event-1/files/edital.pdf",
    );

    const replacementFile = new File(["novo"], "edital-novo.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [replacementFile] },
    });
    expect(onFilesChange).toHaveBeenCalledWith([replacementFile]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remover arquivo atual da norma" }),
    );
    expect(onRemoveCurrent).toHaveBeenCalledOnce();
  });
});
