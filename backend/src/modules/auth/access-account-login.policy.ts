export function canAuthenticateAccessAccount(
  user: { isActive: boolean } | null,
  passwordMatches: boolean,
) {
  return Boolean(user?.isActive && passwordMatches);
}
