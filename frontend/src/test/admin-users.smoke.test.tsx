import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminUsuarios from "@/pages/admin/AdminUsuarios";
import { useAuth } from "@/features/auth/auth-context";
import { useAccessUsersQuery, useCreateAccessUserMutation } from "@/features/users/hooks";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/users/hooks", () => ({
  useAccessUsersQuery: vi.fn(),
  useCreateAccessUserMutation: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAccessUsersQuery = vi.mocked(useAccessUsersQuery);
const mockedUseCreateAccessUserMutation = vi.mocked(useCreateAccessUserMutation);

const adminSession = {
  user: {
    id: "admin-1",
    name: "Administração UNA Pouso Alegre",
    email: "unapousoalegre.oficial@gmail.com",
    role: "ADMIN" as const,
  },
  token: "token-1",
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

function renderUsersPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/usuarios"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/admin/usuarios" element={<AdminUsuarios />} />
        <Route path="/admin" element={<div>Dashboard administrativo</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminUsuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue(adminSession);
    mockedUseAccessUsersQuery.mockReturnValue({
      data: [adminSession.user],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseCreateAccessUserMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("lists accounts and creates a new access user", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      id: "coord-1",
      name: "Maria Clara",
      email: "maria@ulife.com.br",
      role: "COORDENADOR",
      jobTitle: "Coordenadora de Pesquisa",
    });
    mockedUseCreateAccessUserMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderUsersPage();

    expect(screen.getByText("unapousoalegre.oficial@gmail.com")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Maria Clara" },
    });
    fireEvent.change(screen.getByLabelText("E-mail de acesso"), {
      target: { value: "maria@ulife.com.br" },
    });
    fireEvent.change(screen.getByLabelText("Cargo na instituição"), {
      target: { value: "Coordenadora de Pesquisa" },
    });
    fireEvent.change(screen.getByLabelText("Senha inicial"), {
      target: { value: "Senha2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: "Maria Clara",
        email: "maria@ulife.com.br",
        password: "Senha2026",
        role: "COORDENADOR",
        jobTitle: "Coordenadora de Pesquisa",
      }),
    );
  });

  it("redirects coordinators and does not enable the administrative users query", async () => {
    mockedUseAuth.mockReturnValue({
      ...adminSession,
      user: {
        id: "coord-1",
        name: "Coordenação",
        email: "coord@ulife.com.br",
        role: "COORDENADOR",
      },
    });

    renderUsersPage();

    await screen.findByText("Dashboard administrativo");
    expect(mockedUseAccessUsersQuery).toHaveBeenCalledWith(false);
  });
});
