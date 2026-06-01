import { z } from "zod";

export const environmentBooleanSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
