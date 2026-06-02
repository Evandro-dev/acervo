export type CourseSuggestionSource = "explicit-text" | "title" | "content-keyword";

export type CourseSuggestion = {
  name: string;
  score: number;
  source: CourseSuggestionSource;
};

export type CourseSuggestionResult = {
  suggestedCourses: string[];
  courseSuggestions: CourseSuggestion[];
  courseSuggestionConfidence?: "high" | "medium" | "low";
  warnings: string[];
};

type SuggestCoursesFromTextInput = {
  availableCourses: string[];
  title?: string;
  abstract?: string;
  extractedText?: string;
};

const COURSE_KEYWORD_HINTS: Record<string, string[]> = {
  "analise e desenvolvimento de sistemas": [
    "desenvolvimento de sistemas",
    "desenvolvimento de aplicativo",
    "aplicativo",
    "software",
  ],
  agronomia: ["agronomia", "agricultura", "cultivo", "safra"],
  biomedicina: [
    "biomedicina",
    "analises clinicas",
    "exames laboratoriais",
    "hematologia",
    "imunofenotipagem",
  ],
  "ciencia da computacao": ["ciencia da computacao", "algoritmo", "inteligencia artificial"],
  enfermagem: [
    "enfermagem",
    "enfermeira",
    "enfermeiro",
    "assistencia de enfermagem",
    "atencao primaria",
  ],
  estetica: ["estetica", "procedimento estetico", "toxina botulinica"],
  "gestao de recursos humanos": [
    "gestao de recursos humanos",
    "gestao de pessoas",
    "recursos humanos",
  ],
  "medicina veterinaria": [
    "medicina veterinaria",
    "medico veterinario",
    "fauna",
    "zoonose",
    "animal silvestre",
  ],
  odontologia: ["odontologia", "odontologica", "odontologico", "odontologista"],
  pedagogia: ["pedagogia", "ensino aprendizagem", "formacao docente", "docencia"],
  psicologia: ["psicologia", "psicologica", "psicologico", "saude mental"],
  "sistemas de informacao": ["sistemas de informacao", "sistema de informacao"],
};

const EXPLICIT_COURSE_PREFIXES = [
  "curso de",
  "curso em",
  "graduanda em",
  "graduando em",
  "graduandas em",
  "graduandos em",
  "academica do curso de",
  "academico do curso de",
  "academicas do curso de",
  "academicos do curso de",
  "discente do curso de",
  "discentes do curso de",
  "bacharelado em",
];
const THEMATIC_DIRECT_MENTION_BLOCKLIST = new Set(["administracao"]);

function normalizeSearchText(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(normalizedText: string, phrase: string) {
  const normalizedPhrase = normalizeSearchText(phrase);

  if (!normalizedPhrase) {
    return false;
  }

  const pattern = escapeRegExp(normalizedPhrase).replace(/\s+/g, "\\s+");

  return new RegExp(`(?:^|\\s)${pattern}(?:\\s|$)`).test(normalizedText);
}

function hasExplicitCourseMention(normalizedText: string, courseName: string) {
  return EXPLICIT_COURSE_PREFIXES.some((prefix) =>
    containsPhrase(normalizedText, `${prefix} ${courseName}`),
  );
}

function getSuggestionConfidence(
  suggestion: CourseSuggestion | undefined,
): CourseSuggestionResult["courseSuggestionConfidence"] {
  if (!suggestion) {
    return undefined;
  }

  if (suggestion.source === "explicit-text") {
    return "high";
  }

  if (suggestion.source === "title" || suggestion.score >= 10) {
    return "medium";
  }

  return "low";
}

export function suggestCoursesFromText({
  availableCourses,
  title,
  abstract,
  extractedText,
}: SuggestCoursesFromTextInput): CourseSuggestionResult {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedAbstract = normalizeSearchText(abstract);
  const normalizedExtractedText = normalizeSearchText(extractedText);
  const normalizedFullText = `${normalizedTitle} ${normalizedAbstract} ${normalizedExtractedText}`;
  const uniqueCourses = Array.from(
    new Map(
      availableCourses.map((course) => [normalizeSearchText(course), course.trim()]),
    ).values(),
  ).filter(Boolean);

  const courseSuggestions = uniqueCourses
    .map((name): CourseSuggestion | undefined => {
      const normalizedName = normalizeSearchText(name);
      const explicitMention = hasExplicitCourseMention(normalizedFullText, name);
      const acceptsDirectThematicMention = !THEMATIC_DIRECT_MENTION_BLOCKLIST.has(normalizedName);
      const titleMention = acceptsDirectThematicMention && containsPhrase(normalizedTitle, name);
      const abstractMention = acceptsDirectThematicMention && containsPhrase(normalizedAbstract, name);
      const keywordHints = COURSE_KEYWORD_HINTS[normalizedName] ?? [];
      let keywordScore = 0;

      for (const hint of keywordHints) {
        if (containsPhrase(normalizedTitle, hint)) {
          keywordScore += 3;
        } else if (containsPhrase(normalizedAbstract, hint)) {
          keywordScore += 1;
        }
      }

      const score =
        (explicitMention ? 30 : 0) +
        (titleMention ? 12 : abstractMention ? 8 : 0) +
        keywordScore;

      if (score === 0) {
        return undefined;
      }

      return {
        name,
        score,
        source: explicitMention
          ? "explicit-text"
          : titleMention
            ? "title"
            : "content-keyword",
      };
    })
    .filter((suggestion): suggestion is CourseSuggestion => Boolean(suggestion))
    .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
    .slice(0, 8);
  const suggestedCourses = courseSuggestions
    .filter((suggestion) => suggestion.source === "explicit-text")
    .map((suggestion) => suggestion.name);
  const warnings: string[] = [];

  if (suggestedCourses.length === 0) {
    warnings.push(
      courseSuggestions.length > 0
        ? "Os cursos encontrados sao sugestoes tematicas. Revise os cursos relacionados antes de salvar."
        : "Nao foi possivel identificar cursos relacionados automaticamente. Revise esse campo antes de salvar.",
    );
  }

  return {
    suggestedCourses,
    courseSuggestions,
    courseSuggestionConfidence: getSuggestionConfidence(courseSuggestions[0]),
    warnings,
  };
}

export async function suggestCoursesFromArticleText(
  input: Omit<SuggestCoursesFromTextInput, "availableCourses">,
) {
  const { prisma } = await import("../../lib/prisma.js");
  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return suggestCoursesFromText({
    ...input,
    availableCourses: courses.map((course: { name: string }) => course.name),
  });
}
