import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AreaCombobox } from "@/components/ui/area-combobox";

function AreaComboboxHarness() {
  const [value, setValue] = useState("");

  return (
    <AreaCombobox
      value={value}
      options={["Saúde", "Tecnologia e Computação"]}
      onValueChange={setValue}
      placeholder="Tema principal"
    />
  );
}

describe("AreaCombobox", () => {
  it("keeps focus in the input while entering a custom value", () => {
    render(<AreaComboboxHarness />);
    const input = screen.getByPlaceholderText("Tema principal");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Tema" } });
    fireEvent.change(input, { target: { value: "Tema personalizado" } });

    expect(input).toHaveFocus();
    expect(input).toHaveValue("Tema personalizado");
    expect(screen.getByText('Usar "Tema personalizado"')).toBeInTheDocument();
  });

  it("allows selecting a suggested value", () => {
    render(<AreaComboboxHarness />);
    const input = screen.getByPlaceholderText("Tema principal");

    fireEvent.click(input);
    fireEvent.click(screen.getByText("Saúde"));

    expect(input).toHaveValue("Saúde");
  });
});
