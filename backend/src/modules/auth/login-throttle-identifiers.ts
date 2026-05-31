import { normalizeEmailAddress } from "../../lib/institutional-email.js";

export function getLoginThrottleSubjects(email: string, ip: string) {
  return {
    account: normalizeEmailAddress(email) || "__empty__",
    ip: ip.trim() || "__unknown__",
  };
}
