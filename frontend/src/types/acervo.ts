export const eventTypes = [
  "Congresso",
  "Simpósio",
  "Seminário",
  "Workshop",
  "Expo",
] as const;

export type EventType = (typeof eventTypes)[number];

function normalizeEventTypeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const eventTypeByNormalizedValue = new Map<string, EventType>([
  ...eventTypes.map((type) => [normalizeEventTypeKey(type), type] as const),
  ["simposio", "Simpósio"],
  ["simpasio", "Simpósio"],
  ["seminario", "Seminário"],
]);

export function normalizeEventType(value?: string | null): EventType | undefined {
  if (!value) return undefined;

  return eventTypeByNormalizedValue.get(normalizeEventTypeKey(value));
}

export function isEventType(value?: string | null): value is EventType {
  return normalizeEventType(value) === value;
}

export type ArticleStatus = "draft" | "published" | "archived";
export type UserRole = "ADMIN" | "COORDENADOR";

export type FilterValue<T> = T | readonly T[];

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type ArticleListStatus = ArticleStatus | "all";

export type ArticleListFilters = PaginationParams & {
  status?: ArticleListStatus;
  area?: FilterValue<string>;
  course?: FilterValue<string>;
  q?: string;
  eventId?: FilterValue<string>;
  eventYear?: FilterValue<number>;
  modality?: FilterValue<string>;
  hasPdf?: boolean;
  author?: string;
};

export type EventIncludeArticlesMode = "published" | "all" | "none";

export type EventListFilters = PaginationParams & {
  q?: string;
  year?: number;
  type?: FilterValue<EventType>;
  area?: FilterValue<string>;
  includeArticles?: EventIncludeArticlesMode;
};

export type AuthorListFilters = PaginationParams & {
  q?: string;
  area?: FilterValue<string>;
};

export type AuthorSummary = {
  id: string;
  slug: string;
  name: string;
  bio?: string;
  area?: string;
  avatarUrl?: string;
};

export type AreaSummary = {
  id: string;
  name: string;
  articleCount: number;
};

export type CourseSummary = {
  id: string;
  name: string;
  articleCount: number;
};

export type ArticleEventSummary = {
  id: string;
  slug: string;
  title: string;
  year: number;
};

export type EventOption = {
  id: string;
  title: string;
  year: number;
  themes: string[];
};

export type ArticleOptions = {
  events: EventOption[];
  areas: string[];
  modalities: string[];
  years: number[];
};

export type Article = {
  id: string;
  title: string;
  authors: string[];
  authorProfiles: AuthorSummary[];
  area: string;
  courses: string[];
  abstract: string;
  pdfUrl?: string;
  viewCount?: number;
  downloadCount?: number;
  pages: string;
  status: ArticleStatus;
  modality?: string;
  importedFrom?: string;
  externalId?: string;
  submittedAt?: string;
  importedAt?: string;
  publishedAt?: string;
  event?: ArticleEventSummary;
  eventId?: string;
  eventSlug?: string;
  eventTitle?: string;
  eventYear?: number;
};

export type EventCommitteeMember = {
  role: string;
  name: string;
};

export type EventRule = {
  title: string;
  file: string;
};

export type EventPreviousEdition = {
  id: string;
  label: string;
  year: number;
  eventId?: string;
  eventSlug?: string;
  externalUrl?: string;
};

export type EventContact = {
  email: string;
  phone?: string;
};

export type EventCatalog = {
  isbn?: string;
  doi?: string;
  text?: string;
  pdfUrl?: string;
  imageUrl?: string;
};

export type EventCatalogInput = {
  isbn?: string | null;
  doi?: string | null;
  text?: string | null;
  pdfUrl?: string | null;
  imageUrl?: string | null;
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  edition: string;
  year: number;
  date: string;
  area: string;
  type: EventType;
  viewCount?: number;
  cover?: string;
  presentation: string;
  themes: string[];
  committee: EventCommitteeMember[];
  catalog: EventCatalog;
  rules: EventRule[];
  previousEditions: EventPreviousEdition[];
  contact: EventContact;
  articleCount: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
  articles: Article[];
};

export type Author = AuthorSummary & {
  articleCount: number;
  areas: string[];
  works?: Article[];
};

export type ArticleListResponse = PaginatedResponse<Article>;
export type EventListResponse = PaginatedResponse<Event>;
export type AuthorListResponse = PaginatedResponse<Author>;

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  jobTitle?: string;
  bio?: string;
  area?: string;
  avatarUrl?: string;
  isActive: boolean;
  deactivatedAt?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterAccessAccountPayload = {
  name: string;
  email: string;
  jobTitle: string;
  password: string;
};

export type CreateAccessAccountPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  jobTitle?: string;
};

export type UpdateAccessAccountPayload = {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  jobTitle: string | null;
};

export type LoginResponse = {
  user: UserAccount;
  token: string;
};

export type RegisterAccessAccountResponse = {
  message: string;
  user: UserAccount;
};

export type ExtractedArticlePdfMetadata = {
  title?: string;
  authors: string[];
  emails: string[];
  abstract?: string;
  suggestedArea?: string;
  areaSuggestionConfidence?: "high" | "medium" | "low";
  areaSuggestions: Array<{
    name: string;
    score: number;
    source: "event-theme" | "event-area" | "catalog-area";
  }>;
  suggestedCourses?: string[];
  courseSuggestionConfidence?: "high" | "medium" | "low";
  courseSuggestions?: Array<{
    name: string;
    score: number;
    source: "explicit-text" | "title" | "content-keyword";
  }>;
  pageCount: number;
  warnings: string[];
};

export type EventMutationInput = {
  slug?: string;
  title: string;
  edition: string;
  year: number;
  date: string;
  area: string;
  type: EventType;
  coverUrl?: string | null;
  presentation: string;
  themes: string[];
  committee: EventCommitteeMember[];
  rules: EventRule[];
  previousEditions: EventPreviousEdition[];
  contact: EventContact;
  catalog: EventCatalogInput;
};

export type ImportArticleInput = {
  title: string;
  authors: string[];
  area: string;
  courses?: string[];
  abstract: string;
  pages?: string;
  pdfUrl?: string;
  modality?: string;
  importedFrom?: string;
  externalId?: string;
  submittedAt?: string;
  importedAt?: string;
  publishedAt?: string;
  status?: Uppercase<ArticleStatus>;
};

export type ArticleUpdateInput = Partial<ImportArticleInput>;

export type ArticleReportFilters = {
  eventId?: string;
  area?: string;
  course?: string;
  status?: "all" | ArticleStatus;
  dateFrom?: string;
  dateTo?: string;
};

export type GlobalSearchType =
  | "article"
  | "event"
  | "author"
  | "area"
  | "course";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchType;
  title: string;
  subtitle?: string;
  description?: string;
  cover?: string;
  href: string;
  matchedFields: string[];
};

export type GlobalSearchResponse = {
  query: string;
  total: number;
  groups: Record<GlobalSearchType, GlobalSearchResult[]>;
};
