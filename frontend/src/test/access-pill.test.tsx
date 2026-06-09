import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { AccessPill } from "@/components/layout/AccessPill";

describe("AccessPill", () => {
  it("keeps the authenticated access menu expanded after clicking the toggle", () => {
    render(
      <MemoryRouter>
        <AccessPill isAuthenticated isPrivileged onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de acesso" }));

    expect(screen.getByRole("button", { name: "Fechar menu de acesso" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});
