const VIEW_TRACK_TTL_MS = 12 * 60 * 60 * 1000;

function buildViewKey(scope: "article" | "event", id: string) {
  return `acervo:view:${scope}:${id}`;
}

export function reserveViewTracking(scope: "article" | "event", id: string) {
  if (typeof window === "undefined") return false;

  const key = buildViewKey(scope, id);
  const raw = window.localStorage.getItem(key);
  const trackedAt = raw ? Number(raw) : 0;

  if (Number.isFinite(trackedAt) && trackedAt > 0 && Date.now() - trackedAt < VIEW_TRACK_TTL_MS) {
    return false;
  }

  window.localStorage.setItem(key, String(Date.now()));
  return true;
}

export function rollbackViewTracking(scope: "article" | "event", id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(buildViewKey(scope, id));
}
