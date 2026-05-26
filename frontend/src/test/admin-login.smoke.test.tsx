import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminLogin from "@/pages/admin/AdminLogin";
import { useAuth } from "@/features/auth/auth-context";
import { registerAccessAccount } from "@/features/auth/api";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/auth/api", () => ({
  registerAccessAccount: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedRegisterAccessAccount = vi.mocked(registerAccessAccount);

function renderScreen(initialEntry = "/admin/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminLogin />
    </MemoryRouter>,
  );
}

describe("AdminLogin", () => {
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

    mockedRegisterAccessAccount.mockReset();
  });

  it("submits credentials through the auth layer", async () => {
    const login = vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "admin@acervo.edu",
      role: "ADMIN",
    });

    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login,
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderScreen();

    fireEvent.change(screen.getByLabelText("E-mail institucional"), {
      target: { value: "admin@acervo.edu" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "acervo123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "admin@acervo.edu",
        password: "acervo123",
      }),
    );
  });

  it("shows the lockout timer when the API blocks repeated attempts", async () => {
    const login = vi.fn().mockRejectedValue({
      isAxiosError: true,
      message: "blocked",
      response: {
        data: {
          code: "LOGIN_RATE_LIMITED",
          error: "Muitas tentativas de login. Tente novamente em 120 segundos.",
          retryAfterSeconds: 120,
        },
      },
    });

    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login,
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByText("Login temporariamente bloqueado");
    expect(screen.getByText("Muitas tentativas de login. Tente novamente mais tarde.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tente novamente em/i })).toBeDisabled();
  });

  it("submits the coordinator registration form", async () => {
    mockedRegisterAccessAccount.mockResolvedValue({
      message: "Conta criada com sucesso.",
      user: {
        id: "user-2",
        name: "Maria Clara",
        email: "maria@acervo.edu",
        role: "COORDENADOR",
        jobTitle: "Coordenadora de Pesquisa",
      },
    });

    renderScreen("/admin/login?tab=register");

    fireEvent.change(await screen.findByLabelText("Nome completo"), {
      target: { value: "Maria Clara" },
    });
    fireEvent.change(screen.getByLabelText("E-mail institucional"), {
      target: { value: "maria@acervo.edu" },
    });
    fireEvent.change(screen.getByLabelText("Cargo na instituição"), {
      target: { value: "Coordenadora de Pesquisa" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "Senha2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() =>
      expect(mockedRegisterAccessAccount).toHaveBeenCalledWith({
        name: "Maria Clara",
        email: "maria@acervo.edu",
        jobTitle: "Coordenadora de Pesquisa",
        password: "Senha2026",
      }),
    );
  });
});
