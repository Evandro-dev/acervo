import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminUsuarios from "@/pages/admin/AdminUsuarios";
import { useAuth } from "@/features/auth/auth-context";
import {
  useAccessUsersQuery,
  useCreateAccessUserMutation,
  useSetAccessUserActiveMutation,
  useUpdateAccessUserMutation,
} from "@/features/users/hooks";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/users/hooks", () => ({
  useAccessUsersQuery: vi.fn(),
  useCreateAccessUserMutation: vi.fn(),
  useUpdateAccessUserMutation: vi.fn(),
  useSetAccessUserActiveMutation: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAccessUsersQuery = vi.mocked(useAccessUsersQuery);
const mockedUseCreateAccessUserMutation = vi.mocked(useCreateAccessUserMutation);
const mockedUseUpdateAccessUserMutation = vi.mocked(useUpdateAccessUserMutation);
const mockedUseSetAccessUserActiveMutation = vi.mocked(useSetAccessUserActiveMutation);

const adminSession = {
  user: {
    id: "admin-1",
    name: "Administração UNA Pouso Alegre",
    email: "unapousoalegre.oficial@gmail.com",
    role: "ADMIN" as const,
    isActive: true,
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
    <MemoryRouter initialEntries={["/admin/usuarios"]}>
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
    mockedUseUpdateAccessUserMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseSetAccessUserActiveMutation.mockReturnValue({
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
    const createUserIcon = screen.getByTestId("create-access-user-icon");
    const accessUsersListIcon = screen.getByTestId("access-users-list-icon");
    expect(createUserIcon).toHaveClass("bg-brand-soft", "text-primary-dark");
    expect(accessUsersListIcon).toHaveClass("bg-brand-soft", "text-primary-dark");
    expect(createUserIcon.closest(".grid")).toHaveClass("items-start");

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
        isActive: true,
      },
    });

    renderUsersPage();

    await screen.findByText("Dashboard administrativo");
    expect(mockedUseAccessUsersQuery).toHaveBeenCalledWith(false);
  });

  it("edits an account and keeps password replacement optional", async () => {
    const coordinator = {
      id: "coord-1",
      name: "Maria Clara",
      email: "maria@ulife.com.br",
      role: "COORDENADOR" as const,
      jobTitle: "Coordenadora",
      isActive: true,
    };
    const mutateAsync = vi.fn().mockResolvedValue({ ...coordinator, jobTitle: "Professora" });
    mockedUseAccessUsersQuery.mockReturnValue({ data: [coordinator], isLoading: false, isError: false } as never);
    mockedUseUpdateAccessUserMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderUsersPage();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar conta de acesso" });
    fireEvent.change(within(dialog).getByLabelText("Cargo na instituição"), { target: { value: "Professora" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        userId: "coord-1",
        payload: {
          name: "Maria Clara",
          email: "maria@ulife.com.br",
          role: "COORDENADOR",
          jobTitle: "Professora",
        },
      }),
    );
  });

  it("deactivates and reactivates accounts from their cards", async () => {
    const activeCoordinator = {
      id: "coord-1",
      name: "Maria Clara",
      email: "maria@ulife.com.br",
      role: "COORDENADOR" as const,
      isActive: true,
    };
    const inactiveCoordinator = {
      id: "coord-2",
      name: "João Lima",
      email: "joao@ulife.com.br",
      role: "COORDENADOR" as const,
      isActive: false,
    };
    const mutateAsync = vi.fn().mockImplementation(({ userId, isActive }) =>
      Promise.resolve(userId === "coord-1" ? { ...activeCoordinator, isActive } : { ...inactiveCoordinator, isActive }),
    );
    mockedUseAccessUsersQuery.mockReturnValue({
      data: [activeCoordinator, inactiveCoordinator],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseSetAccessUserActiveMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderUsersPage();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    fireEvent.click(screen.getByRole("button", { name: "Desativar acesso" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ userId: "coord-1", isActive: false }));

    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    fireEvent.click(screen.getByRole("button", { name: "Reativar acesso" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ userId: "coord-2", isActive: true }));
  });
});
