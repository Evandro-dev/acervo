export function resolveUpdatedEventCoverUrl(currentCoverUrl: string | null, incomingCoverUrl?: string | null) {
  return incomingCoverUrl === undefined ? currentCoverUrl ?? undefined : incomingCoverUrl;
}
