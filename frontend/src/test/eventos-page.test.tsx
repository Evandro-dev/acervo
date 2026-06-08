import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Eventos from "@/pages/Eventos";
import { useAreasQuery, useGlobalSearchQuery, usePublicEventsQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/acervo/hooks", () => ({
  useAreasQuery: vi.fn(),
  useGlobalSearchQuery: vi.fn(() => ({
    data: undefined,
    isFetching: false,
    isError: false,
  })),
  usePublicEventsQuery: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUsePublicEventsQuery = vi.mocked(usePublicEventsQuery);

function createEvent(overrides: Record<string, unknown>) {
  return {
    id: "event-1",
    slug: "event-1",
    title: "Evento de Saúde",
    cover: undefined,
    edition: "1ª Edição",
    year: 2025,
    date: "10 de Maio de 2025",
    area: "Saúde",
    type: "Expo",
    presentation: "Apresentação",
    themes: ["Cuidado"],
    committee: [],
    catalog: {},
    rules: [],
    previousEditions: [],
    contact: { email: "evento@acervo.edu" },
    articleCount: 0,
    publishedCount: 0,
    draftCount: 0,
    archivedCount: 0,
    articles: [],
    ...overrides,
  };
}

describe("Eventos", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
  });

  it("filters events by registered/event area instead of event themes", () => {
    mockedUseAreasQuery.mockReturnValue({
      data: [
        { id: "area-1", name: "Saúde", articleCount: 1 },
        { id: "area-2", name: "Tecnologia", articleCount: 1 },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useAreasQuery>);
    mockedUsePublicEventsQuery.mockReturnValue({
      data: [
        createEvent({ id: "event-1", slug: "saude", title: "Evento de Saúde", area: "Saúde", themes: ["Cuidado"] }),
        createEvent({
          id: "event-2",
          slug: "tecnologia",
          title: "Evento de Tecnologia",
          area: "Tecnologia",
          themes: ["Saúde"],
        }),
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePublicEventsQuery>);

    render(
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir filtros de eventos" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Saúde" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Evento de Saúde")).toBeInTheDocument();
    expect(screen.queryByText("Evento de Tecnologia")).not.toBeInTheDocument();
    const healthEventCard = screen.getByText("Evento de Saúde").closest(".shadow-card") as HTMLElement;
    expect(within(healthEventCard).getByText("Saúde")).toBeInTheDocument();
  });
});
