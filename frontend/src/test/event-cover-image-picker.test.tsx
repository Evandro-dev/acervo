import { fireEvent, render, screen } from "@testing-library/react";
import { EventCoverImagePicker } from "@/components/admin/EventCoverImagePicker";

describe("EventCoverImagePicker", () => {
  it("shows an upload area while the event has no cover", () => {
    render(<EventCoverImagePicker selectedFile={null} onChange={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("Selecionar imagem do evento")).toBeInTheDocument();
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
    expect(preview).toHaveClass("aspect-video");
    expect(preview.parentElement).toHaveClass("max-w-xl");

    const replaceLabel = screen.getByText("Trocar foto").closest("label");
    expect(replaceLabel).toHaveClass("sm:opacity-0", "sm:group-hover:opacity-100");

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
  });
});
