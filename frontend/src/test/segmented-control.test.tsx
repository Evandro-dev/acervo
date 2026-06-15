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

    expect(screen.getByRole("group", { name: "Origem do arquivo" })).toHaveClass("gap-1", "bg-muted/35");
    expect(uploadOption).toHaveAttribute("aria-pressed", "true");
    expect(uploadOption).toHaveClass("bg-background", "shadow-[inset_0_0_0_1px_hsl(var(--border)),0_1px_2px_rgba(15,23,42,0.08)]");
    expect(externalOption).toHaveAttribute("aria-pressed", "false");
    expect(externalOption).toHaveClass("hover:bg-background/95", "hover:text-foreground");

    fireEvent.click(externalOption);
    expect(onValueChange).toHaveBeenCalledWith("external");
  });
});
