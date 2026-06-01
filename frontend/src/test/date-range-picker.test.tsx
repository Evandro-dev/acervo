import { fireEvent, render, screen, within } from "@testing-library/react";
import { DateRangePicker } from "@/components/ui/date-range-picker";

describe("DateRangePicker", () => {
  it("shows the selected period and allows clearing it", () => {
    const onChange = vi.fn();

    render(
      <DateRangePicker
        label="Período de submissão"
        value={{ from: new Date(2026, 0, 1), to: new Date(2026, 0, 5) }}
        onChange={onChange}
        placeholder="Todos os períodos"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Período de submissão: 1 a 5 de janeiro de 2026" }));
    const calendar = screen.getByRole("application", { name: "Calendário para período de submissão" });
    const grid = within(calendar).getByRole("grid");
    const rows = within(grid).getAllByRole("row");

    expect(grid).toHaveClass("w-full", "border-collapse");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((row) => row.classList.contains("flex"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Limpar período" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("preserves a fallback label for legacy event periods", () => {
    render(
      <DateRangePicker
        label="Período do evento"
        onChange={vi.fn()}
        placeholder="Escolha o período"
        fallbackLabel="12 a 14 de maio de 2025"
      />,
    );

    expect(screen.getByRole("button", { name: "Período do evento: 12 a 14 de maio de 2025" })).toBeInTheDocument();
  });
});
