/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingAuthorInput } from "../../lib/contracts.js";
import { slugify } from "../../lib/slug.js";

type PrismaDb = any;

const normalizeText = (value?: string | null) => value?.trim() || undefined;

async function resolveUniqueSlug(db: PrismaDb, name: string, currentAuthorId?: string) {
  const base = slugify(name);
  const existing = await db.author.findMany({
    where: {
      slug: { startsWith: base },
      ...(currentAuthorId ? { NOT: { id: currentAuthorId } } : {}),
    },
    select: { slug: true },
  });

  const usedSlugs = new Set(existing.map((item: { slug: string }) => item.slug));
  if (!usedSlugs.has(base)) return base;

  let suffix = 2;
  while (usedSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export async function ensureAuthors(db: PrismaDb, rawInputs: IncomingAuthorInput[]) {
  const dedupedInputs = Array.from(
    new Map(
      rawInputs
        .map((input) => ({
          ...input,
          id: normalizeText(input.id),
          name: input.name.trim(),
          bio: normalizeText(input.bio),
          area: normalizeText(input.area),
          avatarUrl: normalizeText(input.avatarUrl),
        }))
        .filter((input) => input.name)
        .map((input) => [input.id ? `id:${input.id}` : `name:${input.name.toLowerCase()}`, input]),
    ).values(),
  );

  const authors = [];

  for (const input of dedupedInputs) {
    if (input.id) {
      const existingById = await db.author.findUnique({ where: { id: input.id } });
      if (!existingById) {
        const error = new Error(`Autor não encontrado: ${input.id}`) as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }

      const nextData = {
        name: input.name || existingById.name,
        bio: input.bio ?? existingById.bio,
        area: input.area ?? existingById.area,
        avatarUrl: input.avatarUrl ?? existingById.avatarUrl,
      };

      const author =
        nextData.name !== existingById.name ||
        nextData.bio !== existingById.bio ||
        nextData.area !== existingById.area ||
        nextData.avatarUrl !== existingById.avatarUrl
          ? await db.author.update({
              where: { id: existingById.id },
              data: nextData,
            })
          : existingById;

      authors.push(author);
      continue;
    }

    const existingByName = await db.author.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
    });

    if (existingByName) {
      const author =
        input.bio !== undefined || input.area !== undefined || input.avatarUrl !== undefined
          ? await db.author.update({
              where: { id: existingByName.id },
              data: {
                bio: input.bio ?? existingByName.bio,
                area: input.area ?? existingByName.area,
                avatarUrl: input.avatarUrl ?? existingByName.avatarUrl,
              },
            })
          : existingByName;

      authors.push(author);
      continue;
    }

    authors.push(
      await db.author.create({
        data: {
          slug: await resolveUniqueSlug(db, input.name),
          name: input.name,
          bio: input.bio,
          area: input.area,
          avatarUrl: input.avatarUrl,
        },
      }),
    );
  }

  return authors;
}
