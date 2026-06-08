import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import Areas from "@/pages/Areas";
import Autores from "@/pages/Autores";
import { useAreasQuery, useAuthorsQuery, useGlobalSearchQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/acervo/hooks", () => ({
  useAreasQuery: vi.fn(),
  useAuthorsQuery: vi.fn(),
  useGlobalSearchQuery: vi.fn(() => ({
    data: undefined,
    isFetching: false,
    isError: false,
  })),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAuthorsQuery = vi.mocked(useAuthorsQuery);

describe("public list filters", () => {
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

  it("filters authors by publication area", () => {
    mockedUseAuthorsQuery.mockReturnValue({
      data: [
        { id: "author-1", slug: "maria", name: "Maria", articleCount: 1, areas: ["Saúde"] },
        { id: "author-2", slug: "joao", name: "João", articleCount: 1, areas: ["Tecnologia"] },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useAuthorsQuery>);

    render(
      <MemoryRouter>
        <Autores />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir filtros de autores" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Saúde" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.queryByText("João")).not.toBeInTheDocument();
  });

  it("keeps empty areas hidden until the filter enables them", () => {
    mockedUseAreasQuery.mockReturnValue({
      data: [
        { id: "area-1", name: "Saúde", articleCount: 1 },
        { id: "area-2", name: "Sem trabalhos", articleCount: 0 },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useAreasQuery>);

    render(
      <MemoryRouter>
        <Areas />
      </MemoryRouter>,
    );

    expect(screen.getByText("Saúde")).toBeInTheDocument();
    expect(screen.queryByText("Sem trabalhos")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir filtros de áreas" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar áreas sem publicações cadastradas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Sem trabalhos")).toBeInTheDocument();
  });
});
