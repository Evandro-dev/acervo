import { createHmac } from "node:crypto";
import { env } from "../../env.js";

export function createAuthFingerprint(namespace: string, value: string) {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`${namespace}:${value}`)
    .digest("hex");
}

export function abbreviateAuthFingerprint(value: string) {
  return value.slice(0, 12);
}
