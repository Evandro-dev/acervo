export const LINE_GROUP_TOLERANCE = 6;
export const MAX_PAGES_TO_SCAN = 5;
export const TITLE_SEARCH_WINDOW = 12;
export const MAX_TITLE_LINES = 4;
export const TITLE_LINE_GAP_LIMIT = 30;
export const AUTHOR_LINE_GAP_LIMIT = 26;
export const MIN_SECTION_CONTENT_LENGTH = 20;

export const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const ABSTRACT_HEADING_ALIASES = [
  "resumo",
  "resumo expandido",
  "abstract",
  "summary",
  "resumen",
];

export const INTRODUCTION_HEADING_ALIASES = ["introducao", "introduction"];

export const ABSTRACT_STOP_HEADING_ALIASES = [
  "palavras chave",
  "palavras-chave",
  "keywords",
  "index terms",
  "termos para indexacao",
  "introducao",
  "introduction",
  "metodos",
  "metodo",
  "metodologia",
  "materials and methods",
  "material e metodos",
  "materiais e metodos",
  "results",
  "resultados",
  "resultados e discussao",
  "discussion",
  "discussao",
  "conclusao",
  "consideracoes finais",
  "referencias",
  "references",
];

export const AFFILIATION_KEYWORDS = [
  "universidade",
  "faculdade",
  "instituto",
  "centro universitario",
  "campus",
  "departamento",
  "laboratorio",
  "programa de pos",
  "discente",
  "docente",
  "professor",
  "professora",
  "graduando",
  "graduanda",
  "mestrando",
  "mestranda",
  "doutorando",
  "doutoranda",
  "pesquisador",
  "pesquisadora",
  "orientador",
  "orientadora",
  "email",
  "e-mail",
  "anima",
  "una",
];

export const METADATA_NOISE_KEYWORDS = [
  "expouna",
  "caderno de resumos",
  "issn",
  "isbn",
  "doi",
  "recebido em",
  "aprovado em",
  "submetido em",
  "licensed under",
];

export const CONNECTOR_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "del", "la", "van", "von"]);
