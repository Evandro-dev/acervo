import { getApiValidationMessage } from "@/lib/api-error-messages";

describe("getApiValidationMessage", () => {
  it("translates current Zod messages and authentication field names", () => {
    expect(
      getApiValidationMessage({
        issues: [
          {
            path: "jobTitle",
            message: "Too small: expected string to have >=2 characters",
          },
          {
            path: "password",
            message: "A senha deve ter pelo menos 8 caracteres.",
          },
          {
            path: "password",
            message: "A senha deve conter ao menos uma letra.",
          },
        ],
      }),
    ).toBe(
      "Verifique: Cargo na instituição: preencha com pelo menos 2 caracteres. Senha: A senha deve ter pelo menos 8 caracteres. Senha: A senha deve conter ao menos uma letra.",
    );
  });

  it("does not expose internal validation details for required fields", () => {
    expect(
      getApiValidationMessage({
        issues: [
          {
            path: "email",
            message: "Invalid input: expected string, received undefined",
          },
        ],
      }),
    ).toBe("Verifique: E-mail: campo obrigatório.");
  });

  it("keeps domain-specific messages returned in Portuguese", () => {
    expect(
      getApiValidationMessage({
        issues: [
          {
            path: "password",
            message: "A senha deve conter ao menos um número.",
          },
        ],
      }),
    ).toBe("Verifique: Senha: A senha deve conter ao menos um número.");
  });
});
