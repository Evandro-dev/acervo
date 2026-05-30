import type { Prisma, Area } from "../../generated/prisma/client";

function normalizeAreaName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAreaLookup(value: string) {
  return normalizeAreaName(value).toLocaleLowerCase();
}

export function sanitizeAreaName(value: string) {
  return normalizeAreaName(value);
}

export async function ensureArea(tx: Prisma.TransactionClient, rawName: string): Promise<Area> {
  const name = normalizeAreaName(rawName);
  const normalizedName = normalizeAreaLookup(name);

  const existing = await tx.area.findUnique({
    where: { normalizedName },
  });

  if (existing) {
    if (existing.name !== name) {
      return tx.area.update({
        where: { id: existing.id },
        data: { name },
      });
    }

    return existing;
  }

  return tx.area.create({
    data: {
      name,
      normalizedName,
    },
  });
}
