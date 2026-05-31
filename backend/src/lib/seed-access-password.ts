export function requireSeedAccessPassword(value?: string) {
  if (!value || value.length < 12) {
    throw new Error("SEED_ACCESS_PASSWORD deve ser configurada com pelo menos 12 caracteres antes de executar o seed.");
  }

  return value;
}
