import { fireEvent, render, screen } from "@testing-library/react";
import { EventCoverImagePicker } from "@/components/admin/EventCoverImagePicker";

describe("EventCoverImagePicker", () => {
  it("shows an upload area while the event has no cover", () => {
    render(<EventCoverImagePicker selectedFile={null} onChange={vi.fn()} onRemove={vi.fn()} />);

    const uploadArea = screen.getByText("Selecionar imagem do evento").closest("label");
    expect(uploadArea).toHaveClass("h-56", "w-full", "sm:h-72");
    expect(screen.getByText("Caso não tenha uma imagem, será exibido um ícone de calendário para seu evento.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Preview da imagem do evento" })).not.toBeInTheDocument();
  });

  it("shows accessible replace and remove actions over the current preview", () => {
    const onRemove = vi.fn();
    render(
      <EventCoverImagePicker
        currentCoverUrl="https://example.com/current.png"
        selectedFile={null}
        onChange={vi.fn()}
        onRemove={onRemove}
      />,
    );

    const preview = screen.getByRole("img", { name: "Preview da imagem do evento" });
    expect(preview).toHaveAttribute("src", "https://example.com/current.png");
    expect(preview).toHaveClass("h-full", "w-full", "object-contain");
    expect(preview.parentElement).toHaveClass("h-56", "w-full", "sm:h-72");

    const replaceLabel = screen.getByText("Trocar foto").closest("label");
    expect(replaceLabel).toHaveClass("sm:opacity-0", "sm:group-hover:opacity-100");
    expect(screen.getByText("Caso não tenha uma imagem, será exibido um ícone de calendário para seu evento.")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: "Remover imagem do evento" });
    expect(removeButton).toHaveClass("rounded-full", "bg-white", "text-destructive");
    expect(removeButton).not.toHaveTextContent("Remover");

    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("returns the selected image file", () => {
    const onChange = vi.fn();
    const { container } = render(<EventCoverImagePicker selectedFile={null} onChange={onChange} onRemove={vi.fn()} />);
    const file = new File(["image-content"], "evento.png", { type: "image/png" });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    expect(onChange).toHaveBeenCalledWith(file);
    expect(screen.queryByText(/Nova imagem selecionada/)).not.toBeInTheDocument();
  });
});
