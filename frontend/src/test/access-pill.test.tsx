import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("moves focus out of the menu before hiding authenticated actions", async () => {
    render(
      <MemoryRouter>
        <AccessPill isAuthenticated isPrivileged onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de acesso" }));

    const panelLink = screen.getByRole("link", { name: "Painel" });
    panelLink.focus();
    expect(panelLink).toHaveFocus();

    fireEvent.click(panelLink);

    await waitFor(() => {
      const trigger = screen.getByRole("button", { name: "Abrir menu de acesso" });
      expect(trigger).toHaveFocus();
      expect(panelLink.closest("[aria-hidden='true']")).not.toContainElement(
        document.activeElement,
      );
    });
  });
});
