import { prisma } from "../../lib/prisma.js";
import { sanitizeAreaName } from "./areas.service.js";

export type AreaSuggestion = {
  name: string;
  score: number;
  source: "event-theme" | "event-area" | "catalog-area";
};

export type AreaSuggestionResult = {
  suggestedArea?: string;
  areaSuggestions: AreaSuggestion[];
  areaSuggestionConfidence?: "high" | "medium" | "low";
  warnings: string[];
};

type AreaCandidate = {
  name: string;
  normalizedName: string;
  source: AreaSuggestion["source"];
};

const STOPWORDS = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "para",
  "por",
  "com",
  "sem",
  "uma",
  "um",
  "sobre",
  "ao",
  "aos",
  "the",
  "of",
  "in",
  "and",
]);

const AREA_KEYWORD_HINTS: Record<string, string[]> = {
  saude: [
    "saude",
    "paciente",
    "pacientes",
    "tratamento",
    "tratamentos",
    "terapeutico",
    "clinica",
    "clinico",
    "diagnostico",
    "doenca",
    "doencas",
    "cuidado",
    "cuidados",
    "prevencao",
    "medula",
  ],
  biomedicina: [
    "biomedicina",
    "biomedico",
    "biomedicos",
    "hematologia",
    "imunologia",
    "patologia",
    "laboratorio",
    "analises",
    "celulas",
    "celulas-tronco",
    "medula",
  ],
  oncologia: [
    "oncologia",
    "oncologico",
    "oncologicos",
    "cancer",
    "tumor",
    "tumores",
    "leucemia",
    "quimioterapia",
    "medula",
    "metastase",
    "neoplasia",
    "oncopediatria",
    "hematopoietico",
    "transplante",
  ],
  tecnologia: [
    "tecnologia",
    "software",
    "sistema",
    "sistemas",
    "algoritmo",
    "algoritmos",
    "inteligencia",
    "artificial",
    "iot",
    "dados",
    "machine",
    "learning",
    "rede",
    "redes",
  ],
  educacao: [
    "educacao",
    "ensino",
    "aprendizagem",
    "escola",
    "escolar",
    "docente",
    "pedagogico",
    "pedagogia",
    "aluno",
    "alunos",
    "professor",
    "professores",
  ],
  "meio ambiente": [
    "ambiental",
    "ambientais",
    "ambiente",
    "ecossistema",
    "ecossistemas",
    "sustentabilidade",
    "sustentavel",
    "biodiversidade",
    "microclima",
    "arborizacao",
    "resiliencia",
    "verde",
    "verdes",
    "azul",
    "azuis",
  ],
  sustentabilidade: [
    "sustentabilidade",
    "sustentavel",
    "resiliencia",
    "ambiental",
    "climatica",
    "microclima",
    "ecologica",
    "ecologico",
    "restauracao",
  ],
  urbanismo: [
    "urbano",
    "urbana",
    "urbanas",
    "urbanismo",
    "cidade",
    "cidades",
    "microclima",
    "ilhas",
    "calor",
    "planejamento",
    "infraestruturas",
    "resiliencia",
  ],
  paisagismo: [
    "paisagismo",
    "paisagistico",
    "planejamento",
    "arborizacao",
    "vegetacao",
    "verde",
    "jardins",
    "calor",
    "microclima",
  ],
  biodiversidade: [
    "biodiversidade",
    "fauna",
    "flora",
    "ecossistemas",
    "ecossistema",
    "vegetacao",
    "arborizacao",
    "meio",
    "ambiente",
  ],
  "arquitetura e urbanismo": [
    "arquitetura",
    "urbanismo",
    "paisagismo",
    "planejamento",
    "urbano",
    "urbana",
    "infraestruturas",
    "resiliencia",
  ],
  engenharia: [
    "engenharia",
    "projeto",
    "projetos",
    "estrutura",
    "estruturas",
    "infraestrutura",
    "infraestruturas",
    "sistema",
    "sistemas",
  ],
};

const DEFAULT_AREA_CANDIDATES = [
  "Saúde",
  "Biomedicina",
  "Oncologia",
  "Tecnologia",
  "Educação",
  "Meio Ambiente",
  "Sustentabilidade",
  "Urbanismo",
  "Paisagismo",
  "Biodiversidade",
  "Arquitetura e Urbanismo",
  "Engenharia",
] as const;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function pushCandidate(map: Map<string, AreaCandidate>, value: string | null | undefined, source: AreaCandidate["source"]) {
  if (!value) return;
  const name = sanitizeAreaName(value);
  if (!name) return;
  const normalizedName = normalizeText(name);
  if (!normalizedName) return;

  const current = map.get(normalizedName);
  if (!current) {
    map.set(normalizedName, { name, normalizedName, source });
    return;
  }

  const priority: Record<AreaCandidate["source"], number> = {
    "event-area": 3,
    "event-theme": 2,
    "catalog-area": 1,
  };

  if (priority[source] > priority[current.source]) {
    map.set(normalizedName, { name, normalizedName, source });
  }
}

async function listCandidates(eventId?: string) {
  const areaMap = new Map<string, AreaCandidate>();

  for (const areaName of DEFAULT_AREA_CANDIDATES) {
    pushCandidate(areaMap, areaName, "catalog-area");
  }

  const catalogAreas = await prisma.area.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });

  for (const area of catalogAreas) {
    pushCandidate(areaMap, area.name, "catalog-area");
  }

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { area: true, themes: true },
    });

    if (event) {
      pushCandidate(areaMap, event.area, "event-area");
      for (const theme of event.themes) {
        pushCandidate(areaMap, theme, "event-theme");
      }
    }
  }

  return [...areaMap.values()];
}

function computeConfidence(score: number, runnerUpScore: number) {
  if (score >= 12 && score - runnerUpScore >= 4) return "high" as const;
  if (score >= 7) return "medium" as const;
  return "low" as const;
}

function scoreCandidate(candidate: AreaCandidate, titleText: string, fullText: string, titleTokens: Set<string>, textTokens: Set<string>) {
  let score = 0;
  const matched = new Set<string>();
  const phrase = candidate.normalizedName;
  const nameTokens = tokenize(candidate.name);
  const hintTokens = AREA_KEYWORD_HINTS[phrase] ?? [];

  if (phrase && titleText.includes(phrase)) {
    score += 12;
    matched.add(candidate.name);
  } else if (phrase && fullText.includes(phrase)) {
    score += 8;
    matched.add(candidate.name);
  }

  for (const token of nameTokens) {
    if (titleTokens.has(token)) {
      score += 4;
      matched.add(token);
    } else if (textTokens.has(token)) {
      score += 2;
      matched.add(token);
    }
  }

  for (const token of hintTokens) {
    if (titleTokens.has(token)) {
      score += 3;
      matched.add(token);
    } else if (textTokens.has(token)) {
      score += 1.5;
      matched.add(token);
    }
  }

  if (candidate.source === "event-area" && score > 0) {
    score += 0.5;
  }

  return {
    score,
    matched,
  };
}

export async function suggestAreaFromArticleText(input: {
  title?: string;
  abstract?: string;
  eventId?: string;
}): Promise<AreaSuggestionResult> {
  const title = input.title?.trim() ?? "";
  const abstract = input.abstract?.trim() ?? "";
  const titleText = normalizeText(title);
  const fullText = normalizeText([title, abstract].filter(Boolean).join(" "));
  const titleTokens = new Set(tokenize(title));
  const textTokens = new Set(tokenize([title, abstract].filter(Boolean).join(" ")));
  const candidates = await listCandidates(input.eventId);

  if (!candidates.length || !fullText) {
    return {
      areaSuggestions: [],
      warnings: ["Não foi possível sugerir uma área automaticamente com os dados disponíveis."],
    };
  }

  const scored = candidates
    .map((candidate) => {
      const result = scoreCandidate(candidate, titleText, fullText, titleTokens, textTokens);
      return {
        name: candidate.name,
        source: candidate.source,
        score: result.score,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  if (!scored.length) {
    return {
      areaSuggestions: candidates.slice(0, 5).map((candidate) => ({
        name: candidate.name,
        source: candidate.source,
        score: 0,
      })),
      warnings: ["Nenhuma área teve correspondência forte com o título e o resumo. Revise manualmente."],
    };
  }

  const top = scored[0];
  const runnerUpScore = scored[1]?.score ?? 0;
  const confidence = computeConfidence(top.score, runnerUpScore);
  const warnings: string[] = [];

  if (confidence === "low") {
    warnings.push("A sugestão de área tem baixa confiança. Revise antes de salvar.");
  }

  return {
    suggestedArea: top.name,
    areaSuggestions: scored.slice(0, 5),
    areaSuggestionConfidence: confidence,
    warnings,
  };
}
