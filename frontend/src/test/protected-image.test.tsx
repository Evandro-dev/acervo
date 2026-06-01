import { render, screen } from "@testing-library/react";
import { ProtectedImage } from "@/components/ui/protected-image";

describe("ProtectedImage", () => {
  it("discourages direct image dragging and context-menu downloads", () => {
    render(<ProtectedImage src="/cover.png" alt="Capa do evento" />);
    const image = screen.getByRole("img", { name: "Capa do evento" });
    const dragEvent = new Event("dragstart", { bubbles: true, cancelable: true });
    const contextMenuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    image.dispatchEvent(dragEvent);
    image.dispatchEvent(contextMenuEvent);

    expect(image).toHaveAttribute("draggable", "false");
    expect(image).toHaveClass("select-none");
    expect(dragEvent.defaultPrevented).toBe(true);
    expect(contextMenuEvent.defaultPrevented).toBe(true);
  });
});
