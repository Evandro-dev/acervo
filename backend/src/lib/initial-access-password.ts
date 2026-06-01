function requireInitialAccessPassword(variableName: string, value?: string) {
  if (!value || value.length < 12 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new Error(
      `${variableName} deve ser configurada com pelo menos 12 caracteres, incluindo letra e número.`,
    );
  }

  return value;
}

export function requireSeedAccessPassword(value?: string) {
  return requireInitialAccessPassword("SEED_ACCESS_PASSWORD", value);
}

export function requireAdminBootstrapPassword(value?: string) {
  return requireInitialAccessPassword("ADMIN_BOOTSTRAP_PASSWORD", value);
}
