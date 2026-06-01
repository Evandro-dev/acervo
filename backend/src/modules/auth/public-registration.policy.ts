export const publicCoordinatorRegistrationDisabledResponse = {
  code: "PUBLIC_REGISTRATION_DISABLED",
  error: "O cadastro público está desativado. Solicite seu acesso a um administrador.",
} as const;

export function getPublicCoordinatorRegistrationRestriction(enabled: boolean) {
  return enabled ? null : publicCoordinatorRegistrationDisabledResponse;
}
