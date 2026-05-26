import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Home from "@/pages/Home";
import { usePublicEventsQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/acervo/hooks", () => ({
  usePublicEventsQuery: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUsePublicEventsQuery = vi.mocked(usePublicEventsQuery);
const mockedUseAuth = vi.mocked(useAuth);

describe("Home", () => {
  it("renders API-driven highlights with the parent event link", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    mockedUsePublicEventsQuery.mockReturnValue({
      data: [
        {
          id: "event-1",
          slug: "evento-1",
          title: "Evento de Teste",
          edition: "1ª Edição",
          year: 2025,
          date: "10 de Maio de 2025",
          area: "Tecnologia",
          type: "Congresso",
          presentation: "Apresentação do evento",
          themes: ["Tecnologia"],
          committee: [],
          catalog: {},
          rules: [],
          previousEditions: [],
          contact: { email: "evento@acervo.edu" },
          articleCount: 1,
          publishedCount: 1,
          draftCount: 0,
          archivedCount: 0,
          articles: [
            {
              id: "article-1",
              title: "Artigo em Destaque",
              authors: ["Autor Um"],
              authorProfiles: [{ id: "author-1", slug: "autor-um", name: "Autor Um" }],
              area: "Tecnologia",
              abstract: "Resumo do artigo",
              pages: "1-10",
              status: "published",
              eventTitle: "Evento de Teste",
              eventYear: 2025,
            },
          ],
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePublicEventsQuery>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Evento de Teste").length).toBeGreaterThan(0);
    expect(screen.getByText("Artigo em Destaque")).toBeInTheDocument();
    expect(screen.getByText("Publicação em destaque")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ler artigo/i })).toHaveAttribute("href", "/eventos/evento-1/artigos/article-1");
  });
});
