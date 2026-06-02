import { fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl } from "@/components/ui/segmented-control";

describe("SegmentedControl", () => {
  it("exposes accessible state and a consistent hover style", () => {
    const onValueChange = vi.fn();

    render(
      <SegmentedControl
        ariaLabel="Origem do arquivo"
        value="upload"
        onValueChange={onValueChange}
        options={[
          { value: "upload", label: "Enviar PDF" },
          { value: "external", label: "Usar link externo" },
        ]}
      />,
    );

    const uploadOption = screen.getByRole("button", { name: "Enviar PDF" });
    const externalOption = screen.getByRole("button", { name: "Usar link externo" });

    expect(screen.getByRole("group", { name: "Origem do arquivo" })).toHaveClass("gap-2", "bg-muted");
    expect(uploadOption).toHaveAttribute("aria-pressed", "true");
    expect(uploadOption).toHaveClass("bg-background", "shadow-card");
    expect(externalOption).toHaveAttribute("aria-pressed", "false");
    expect(externalOption).toHaveClass("hover:bg-background/70", "hover:text-foreground");

    fireEvent.click(externalOption);
    expect(onValueChange).toHaveBeenCalledWith("external");
  });
});
