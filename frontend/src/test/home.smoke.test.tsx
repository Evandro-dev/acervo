import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Home from "@/pages/Home";
import {
  usePublicEventsQuery,
  usePublishedArticlesQuery,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/acervo/hooks", () => ({
  usePublicEventsQuery: vi.fn(),
  usePublishedArticlesQuery: vi.fn(),
  useGlobalSearchQuery: vi.fn(() => ({
    data: undefined,
    isFetching: false,
    isError: false,
  })),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUsePublicEventsQuery = vi.mocked(usePublicEventsQuery);
const mockedUsePublishedArticlesQuery = vi.mocked(usePublishedArticlesQuery);
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
      data: {
        items: [
          {
            id: "event-1",
            slug: "evento-1",
            title: "Evento de Teste",
            cover: "/events/event-1/cover/capa.jpg",
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
            articles: [],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 3,
        pageCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePublicEventsQuery>);
    mockedUsePublishedArticlesQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "article-1",
            title: "Artigo em Destaque",
            authors: ["Autor Um"],
            authorProfiles: [
              { id: "author-1", slug: "autor-um", name: "Autor Um" },
            ],
            area: "Tecnologia",
            courses: [],
            abstract: "Resumo do artigo",
            pages: "1-10",
            status: "published",
            eventId: "event-1",
            eventSlug: "evento-1",
            eventTitle: "Evento de Teste",
            eventYear: 2025,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1,
        pageCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePublishedArticlesQuery>);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    const unaLink = screen.getByRole("link", {
      name: "Acessar site da UNA Pouso Alegre",
    });
    expect(unaLink).toHaveAttribute(
      "href",
      "https://www.una.br/unidades/pouso-alegre/",
    );
    expect(unaLink).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("img", { name: "Una" })).toHaveAttribute(
      "src",
      "/logo_una.svg",
    );
    expect(screen.getAllByRole("img", { name: "Acervo" })).toHaveLength(2);
    for (const logo of screen.getAllByRole("img", { name: "Acervo" })) {
      expect(logo).toHaveAttribute("src", "/logo_acervo.svg");
    }
    expect(screen.getAllByText("Evento de Teste").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: "Imagem do evento Evento de Teste" }),
    ).toHaveAttribute("draggable", "false");
    expect(screen.getByText("Artigo em Destaque")).toBeInTheDocument();
    expect(screen.getByText("Publicação em destaque")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ler artigo/i })).toHaveAttribute(
      "href",
      "/eventos/evento-1/artigos/article-1",
    );
  });
});
