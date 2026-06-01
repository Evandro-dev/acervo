export type ManagedAccessAccountField = "name" | "email" | "jobTitle" | "role" | "password";

export function wouldRemoveLastActiveAdministrator(input: {
  targetIsActive: boolean;
  targetRole: string;
  nextIsActive: boolean;
  nextRole: string;
  activeAdministratorCount: number;
}) {
  const currentlyCountsAsAdministrator = input.targetIsActive && input.targetRole === "ADMIN";
  const willCountAsAdministrator = input.nextIsActive && input.nextRole === "ADMIN";

  return currentlyCountsAsAdministrator && !willCountAsAdministrator && input.activeAdministratorCount <= 1;
}

export function shouldRevokeSessionsAfterAccessAccountUpdate(changedFields: ManagedAccessAccountField[]) {
  return changedFields.some((field) => field === "email" || field === "password" || field === "role");
}
