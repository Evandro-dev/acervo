import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CourseMultiCombobox } from "@/components/ui/course-multi-combobox";

function CourseMultiComboboxHarness() {
  const [value, setValue] = useState("");

  return (
    <CourseMultiCombobox
      value={value}
      options={["Biomedicina", "Medicina Veterinária"]}
      onValueChange={setValue}
      placeholder="Cursos relacionados"
    />
  );
}

describe("CourseMultiCombobox", () => {
  it("allows selecting, adding and removing related courses", () => {
    render(<CourseMultiComboboxHarness />);
    const input = screen.getByPlaceholderText("Cursos relacionados");

    fireEvent.focus(input);
    expect(screen.getByRole("listbox", { name: "Cursos relacionados" })).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
    fireEvent.click(screen.getByText("Biomedicina"));
    expect(screen.getByRole("button", { name: "Remover curso Biomedicina" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Biomedicina" })).toHaveAttribute("aria-selected", "true");

    fireEvent.change(input, { target: { value: "Engenharia Elétrica" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Engenharia Elétrica")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover curso Biomedicina" }));
    expect(screen.queryByRole("button", { name: "Remover curso Biomedicina" })).not.toBeInTheDocument();
    expect(screen.getByText("Engenharia Elétrica")).toBeInTheDocument();
  });
});
