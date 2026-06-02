import { fireEvent, render, screen } from "@testing-library/react";
import { PdfFilePicker } from "@/components/admin/PdfFilePicker";

describe("PdfFilePicker", () => {
  it("shows a reusable upload area with hover feedback", () => {
    render(
      <PdfFilePicker
        title="Selecionar PDF da norma"
        description="Envie o arquivo PDF."
        onFilesChange={vi.fn()}
      />,
    );

    const uploadArea = screen.getByText("Selecionar PDF da norma").closest("label");
    expect(uploadArea).toHaveClass("border-dashed", "hover:bg-muted/50");
    expect(screen.getByText("Envie o arquivo PDF.")).toBeInTheDocument();
  });

  it("returns selected files and allows replacing or removing a selected PDF", () => {
    const onFilesChange = vi.fn();
    const onRemove = vi.fn();
    const selectedFile = new File(["pdf-content"], "edital.pdf", { type: "application/pdf" });
    const { container } = render(
      <PdfFilePicker
        title="Selecionar PDF"
        description="Envie o arquivo PDF."
        selectedFile={selectedFile}
        onFilesChange={onFilesChange}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("edital.pdf")).toBeInTheDocument();
    expect(screen.getByText("11 B")).toBeInTheDocument();
    expect(screen.getByText("Trocar PDF").closest("label")).toHaveClass("hover:bg-accent");

    const replacementFile = new File(["new-content"], "edital-atualizado.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [replacementFile] } });
    expect(onFilesChange).toHaveBeenCalledWith([replacementFile]);

    fireEvent.click(screen.getByRole("button", { name: "Remover PDF selecionado" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
