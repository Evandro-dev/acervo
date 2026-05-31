import dotenv from "dotenv";
import { z } from "zod";
import { isSupportedDuration } from "./lib/duration.js";
import { resolveInstitutionalEmailDomains } from "./lib/institutional-email.js";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z
    .string()
    .refine(isSupportedDuration, "JWT_EXPIRES_IN deve usar uma duração como 30m, 12h ou 7d.")
    .default("12h"),
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  PORT: z.coerce.number().default(10000),
  CORS_ORIGIN: z.string().default(
    "http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,https://acervo-0fud.onrender.com,https://acervouna.vercel.app/,https://acervouna.com.br",
  ),
  INSTITUTIONAL_EMAIL_DOMAIN: z.string().optional(),
  INSTITUTIONAL_EMAIL_DOMAINS: z.string().optional(),
});

const parsedEnv = schema.parse(process.env);
const { INSTITUTIONAL_EMAIL_DOMAIN, ...envWithoutLegacyEmailDomain } = parsedEnv;

export const env = {
  ...envWithoutLegacyEmailDomain,
  INSTITUTIONAL_EMAIL_DOMAINS: resolveInstitutionalEmailDomains({
    domains: parsedEnv.INSTITUTIONAL_EMAIL_DOMAINS,
    legacyDomain: INSTITUTIONAL_EMAIL_DOMAIN,
  }),
};
