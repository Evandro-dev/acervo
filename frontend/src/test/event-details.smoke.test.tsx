import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventoDetalhe from "@/pages/EventoDetalhe";
import { useEventQuery, useTrackEventViewMutation } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/acervo/hooks", () => ({
  useEventQuery: vi.fn(),
  useTrackEventViewMutation: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseEventQuery = vi.mocked(useEventQuery);
const mockedUseTrackEventViewMutation = vi.mocked(useTrackEventViewMutation);
const mockedUseAuth = vi.mocked(useAuth);

describe("EventoDetalhe", () => {
  it("uses the branded administrative navigation style for the active tab", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    mockedUseEventQuery.mockReturnValue({
      data: {
        id: "event-1",
        slug: "expo-una-2025",
        title: "EXPO UNA 2025",
        edition: "1ª Edição",
        year: 2025,
        date: "1 a 5 de dezembro de 2025",
        area: "Troca, inovação e impacto social",
        type: "Expo",
        presentation: "Apresentação pública do evento.",
        themes: [],
        committee: [],
        catalog: {},
        rules: [],
        previousEditions: [],
        contact: { email: "evento@ulife.com.br" },
        articleCount: 0,
        publishedCount: 0,
        draftCount: 0,
        archivedCount: 0,
        articles: [],
      },
      isLoading: false,
      isError: false,
    } as never);
    mockedUseTrackEventViewMutation.mockReturnValue({ mutate: vi.fn() } as never);

    render(
      <MemoryRouter initialEntries={["/eventos/expo-una-2025"]}>
        <EventoDetalhe />
      </MemoryRouter>,
    );

    const activeTab = screen.getByRole("tab", { name: "Apresentação" });
    expect(activeTab).toHaveAttribute("data-state", "active");
    expect(activeTab).toHaveClass("bg-brand", "!text-primary-foreground", "shadow-sm");

    const publicationsTab = screen.getByRole("tab", { name: "Publicações" });
    fireEvent.mouseDown(publicationsTab);
    fireEvent.click(publicationsTab);
    expect(publicationsTab).toHaveAttribute("data-state", "active");
    expect(publicationsTab).toHaveClass("bg-brand", "!text-primary-foreground", "shadow-sm");
    expect(activeTab).toHaveClass("text-foreground/70", "hover:bg-muted");
  });
});
