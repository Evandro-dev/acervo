import type { Course, Prisma } from "../../generated/prisma/client.js";

function normalizeCourseName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCourseLookup(value: string) {
  return normalizeCourseName(value).toLocaleLowerCase();
}

export function sanitizeCourseName(value: string) {
  return normalizeCourseName(value);
}

export function uniqueCourseNames(values: string[]) {
  const courses = new Map<string, string>();

  for (const value of values) {
    const name = sanitizeCourseName(value);
    if (!name) continue;
    const normalizedName = normalizeCourseLookup(name);
    if (!courses.has(normalizedName)) courses.set(normalizedName, name);
  }

  return [...courses.values()];
}

export async function ensureCourses(tx: Prisma.TransactionClient, rawNames: string[]): Promise<Course[]> {
  const names = uniqueCourseNames(rawNames);
  const courses: Course[] = [];

  for (const name of names) {
    const normalizedName = normalizeCourseLookup(name);
    courses.push(
      await tx.course.upsert({
        where: { normalizedName },
        update: { name },
        create: { name, normalizedName },
      }),
    );
  }

  return courses;
}
