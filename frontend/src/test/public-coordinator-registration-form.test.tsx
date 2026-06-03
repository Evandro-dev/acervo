import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicCoordinatorRegistrationForm } from "@/components/auth/PublicCoordinatorRegistrationForm";
import { registerAccessAccount } from "@/features/auth/api";

vi.mock("@/features/auth/api", () => ({
  registerAccessAccount: vi.fn(),
}));

const mockedRegisterAccessAccount = vi.mocked(registerAccessAccount);

describe("PublicCoordinatorRegistrationForm", () => {
  beforeEach(() => {
    mockedRegisterAccessAccount.mockReset();
  });

  it("keeps the preserved coordinator registration implementation reusable", async () => {
    const onCompleted = vi.fn();

    mockedRegisterAccessAccount.mockResolvedValue({
      message: "Conta criada com sucesso.",
      user: {
        id: "user-2",
        name: "Maria Clara",
        email: "maria@ulife.com.br",
        role: "COORDENADOR",
        isActive: true,
        jobTitle: "Coordenadora de Pesquisa",
      },
    });

    render(<PublicCoordinatorRegistrationForm onCompleted={onCompleted} />);

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Maria Clara" },
    });
    fireEvent.change(screen.getByLabelText("E-mail institucional"), {
      target: { value: "maria@ulife.com.br" },
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
        email: "maria@ulife.com.br",
        jobTitle: "Coordenadora de Pesquisa",
        password: "Senha2026",
      }),
    );

    expect(onCompleted).toHaveBeenCalledWith("maria@ulife.com.br");
  });
});
