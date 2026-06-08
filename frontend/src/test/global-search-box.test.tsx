import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { useGlobalSearchQuery } from "@/features/acervo/hooks";
import type { GlobalSearchResponse } from "@/types/acervo";

vi.mock("@/hooks/use-debounced-value", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("@/features/acervo/hooks", () => ({
  useGlobalSearchQuery: vi.fn(),
}));

const emptyGroups: GlobalSearchResponse["groups"] = {
  article: [],
  event: [],
  author: [],
  area: [],
  course: [],
};

const mockedUseGlobalSearchQuery = vi.mocked(useGlobalSearchQuery);

describe("GlobalSearchBox", () => {
  beforeEach(() => {
    mockedUseGlobalSearchQuery.mockImplementation((query) => ({
      data:
        query.length >= 2
          ? {
              query,
              total: 3,
              groups: {
                ...emptyGroups,
                article: [
                  {
                    id: "article-1",
                    type: "article",
                    title: "Anemia ferropriva em crianças",
                    subtitle: "EXPO UNA 2025 · Ana Silva",
                    description: "Resumo sobre anemia e cuidados interdisciplinares.",
                    href: "/eventos/expo-una-2025/artigos/article-1",
                    matchedFields: ["Título", "Resumo"],
                  },
                ],
                event: [
                  {
                    id: "event-1",
                    type: "event",
                    title: "EXPO UNA 2025",
                    href: "/eventos/expo-una-2025",
                    matchedFields: ["Título"],
                  },
                ],
                course: [
                  {
                    id: "course-1",
                    type: "course",
                    title: "Biomedicina",
                    subtitle: "1 publicação",
                    href: "/publicacoes?course=Biomedicina",
                    matchedFields: ["Curso"],
                  },
                ],
              },
            }
          : undefined,
      isFetching: false,
      isError: false,
    }));
  });

  it("shows grouped global suggestions with navigable links", async () => {
    render(
      <MemoryRouter>
        <GlobalSearchBox placeholder="Pesquisar" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Buscar no Acervo" }), {
      target: { value: "anemia" },
    });

    expect(await screen.findByText("Busca geral do Acervo")).toBeInTheDocument();
    expect(screen.getByText("Publicações")).toBeInTheDocument();
    expect(screen.getByText("Eventos")).toBeInTheDocument();
    expect(screen.getByText("Cursos")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Anemia ferropriva em crianças/i })).toHaveAttribute(
      "href",
      "/eventos/expo-una-2025/artigos/article-1",
    );
    expect(screen.getByRole("option", { name: /Biomedicina/i })).toHaveAttribute(
      "href",
      "/publicacoes?course=Biomedicina",
    );
  });

  it("highlights matching result text even when the query omits accents", async () => {
    mockedUseGlobalSearchQuery.mockImplementation((query) => ({
      data:
        query.length >= 2
          ? {
              query,
              total: 1,
              groups: {
                ...emptyGroups,
                article: [
                  {
                    id: "article-2",
                    type: "article",
                    title: "Saúde coletiva no campus",
                    href: "/eventos/expo-una-2025/artigos/article-2",
                    matchedFields: ["Título"],
                  },
                ],
              },
            }
          : undefined,
      isFetching: false,
      isError: false,
    }));

    render(
      <MemoryRouter>
        <GlobalSearchBox placeholder="Pesquisar" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Buscar no Acervo" }), {
      target: { value: "saude" },
    });

    const highlightedText = await screen.findByText("Saúde");
    expect(highlightedText.tagName).toBe("MARK");
  });
});
