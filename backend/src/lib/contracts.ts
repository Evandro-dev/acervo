import { z } from "zod";

export const eventTypeValues = ["Congresso", "Simpósio", "Seminário", "Workshop", "Expo"] as const;
export const eventTypeSchema = z.enum(eventTypeValues);

export const eventCommitteeMemberSchema = z.object({
  role: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
});

export const eventCommitteeSchema = z.array(eventCommitteeMemberSchema);

export const eventRuleSchema = z.object({
  title: z.string().min(1).max(160),
  file: z.string().min(1).max(500),
});

export const eventRulesSchema = z.array(eventRuleSchema);

export const eventPreviousEditionSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  year: z.number().int().min(1900).max(3000),
  eventId: z.string().min(1).max(120).optional(),
  eventSlug: z.string().min(1).max(160).optional(),
  externalUrl: z.string().url().max(500).optional(),
});

export const eventPreviousEditionsSchema = z.array(eventPreviousEditionSchema);

export const eventCatalogSchema = z.object({
  isbn: z.string().max(80).optional(),
  doi: z.string().max(120).optional(),
  publisher: z.string().max(160).optional(),
  address: z.string().max(240).optional(),
});

export const eventContactSchema = z.object({
  email: z.string().email(),
  phone: z.string().max(40).optional(),
});

export const authorPayloadSchema = z.union([
  z.string().min(2).max(160),
  z.object({
    id: z.string().optional(),
    name: z.string().min(2).max(160),
    bio: z.string().max(500).optional(),
    area: z.string().max(120).optional(),
    avatarUrl: z.string().url().optional(),
  }),
]);

export type IncomingAuthorInput = {
  id?: string;
  name: string;
  bio?: string;
  area?: string;
  avatarUrl?: string;
};

export function normalizeAuthorPayload(payload: z.infer<typeof authorPayloadSchema>): IncomingAuthorInput {
  if (typeof payload === "string") {
    return { name: payload };
  }

  return payload;
}

export type EventCommitteeMember = z.infer<typeof eventCommitteeMemberSchema>;
export type EventRule = z.infer<typeof eventRuleSchema>;
export type EventPreviousEdition = z.infer<typeof eventPreviousEditionSchema>;
