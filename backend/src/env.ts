import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("12h"),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z.string().default(
    "http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173",
  ),
  INSTITUTIONAL_EMAIL_DOMAIN: z.string().default("acervo.edu"),
});

export const env = schema.parse(process.env);
