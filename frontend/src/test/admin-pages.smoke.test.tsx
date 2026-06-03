import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminImportar from "@/pages/admin/AdminImportar";
import AdminPublicacoes from "@/pages/admin/AdminPublicacoes";
import {
  useAdminArticlesQuery,
  useAdminEventsQuery,
  useAreasQuery,
  useCoursesQuery,
  useDeleteArticleMutation,
  useExtractArticlePdfMetadataMutation,
  useImportArticlesMutation,
  useUpdateArticleStatusMutation,
  useUploadArticlePdfMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";

vi.mock("@/features/acervo/hooks", () => ({
  useAdminEventsQuery: vi.fn(),
  useAdminArticlesQuery: vi.fn(),
  useAreasQuery: vi.fn(),
  useCoursesQuery: vi.fn(),
  useUpdateArticleStatusMutation: vi.fn(),
  useDeleteArticleMutation: vi.fn(),
  useExtractArticlePdfMetadataMutation: vi.fn(),
  useUploadArticlePdfMutation: vi.fn(),
  useImportArticlesMutation: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const mockedUseAdminEventsQuery = vi.mocked(useAdminEventsQuery);
const mockedUseAdminArticlesQuery = vi.mocked(useAdminArticlesQuery);
const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseCoursesQuery = vi.mocked(useCoursesQuery);
const mockedUseUpdateArticleStatusMutation = vi.mocked(useUpdateArticleStatusMutation);
const mockedUseDeleteArticleMutation = vi.mocked(useDeleteArticleMutation);
const mockedUseExtractArticlePdfMetadataMutation = vi.mocked(useExtractArticlePdfMetadataMutation);
const mockedUseUploadArticlePdfMutation = vi.mocked(useUploadArticlePdfMutation);
const mockedUseImportArticlesMutation = vi.mocked(useImportArticlesMutation);
const mockedUseAuth = vi.mocked(useAuth);
const mockedToast = vi.mocked(toast);

function renderAdminPage(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const adminSession = {
  user: {
    id: "user-1",
    name: "Admin",
    email: "admin@acervo.edu",
    role: "ADMIN" as const,
    isActive: true,
  },
  token: "token-1",
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

const adminEvent = {
  id: "event-1",
  slug: "evento-1",
  title: "Congresso de Teste",
  edition: "1ª Edição",
  year: 2026,
  date: "10 a 12 de Maio de 2026",
  area: "Tecnologia",
  type: "Congresso" as const,
  presentation: "Apresentação do evento",
  themes: ["Tecnologia", "Educação"],
  committee: [],
  catalog: {},
  rules: [],
  previousEditions: [],
  contact: { email: "evento@acervo.edu" },
  articleCount: 20,
  publishedCount: 11,
  draftCount: 7,
  archivedCount: 3,
  articles: [],
};

const adminArticle = {
  id: "article-1",
  title: "Artigo em Revisão",
  authors: ["Ana Silva", "Carlos Lima"],
  authorProfiles: [],
  area: "Tecnologia",
  abstract: "Resumo do artigo",
  pages: "1-10",
  status: "draft" as const,
  eventId: "event-1",
  eventSlug: "evento-1",
  eventTitle: "Congresso de Teste",
  eventYear: 2026,
  importedFrom: "Importação manual",
  externalId: "EXT-001",
};

describe("Admin pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue(adminSession);
    mockedUseAreasQuery.mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    mockedUseCoursesQuery.mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    mockedUseDeleteArticleMutation.mockReturnValue({ mutateAsync: vi.fn() } as never);
    mockedUseUpdateArticleStatusMutation.mockReturnValue({ mutateAsync: vi.fn() } as never);
    mockedUseExtractArticlePdfMetadataMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    mockedUseUploadArticlePdfMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    mockedUseImportArticlesMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it("renders dashboard metrics from API data", () => {
    mockedUseAdminEventsQuery.mockReturnValue({
      data: [
        adminEvent,
        {
          ...adminEvent,
          id: "event-2",
          slug: "evento-2",
          title: "Simposio de Pesquisa",
          publishedCount: 2,
          draftCount: 1,
          archivedCount: 0,
        },
      ],
      isLoading: false,
      isError: false,
    } as never);

    renderAdminPage(<AdminDashboard />);

    expect(screen.getByText("Importar trabalhos")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByText("8")).toHaveLength(2);
    expect(screen.getByText("8 rascunhos prontos para publicar")).toBeInTheDocument();
  });

  it("publishes a draft article from admin curation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});

    mockedUseAdminEventsQuery.mockReturnValue({
      data: [adminEvent],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseAdminArticlesQuery.mockReturnValue({
      data: [adminArticle],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseUpdateArticleStatusMutation.mockReturnValue({ mutateAsync } as never);

    renderAdminPage(<AdminPublicacoes />);

    const publishedTab = screen.getByRole("button", { name: /Publicados/ });
    expect(publishedTab).toHaveClass("hover:bg-background/70", "hover:text-foreground");
    expect(publishedTab.parentElement).toHaveClass("gap-2");
    expect(publishedTab).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: "article-1",
        status: "PUBLISHED",
      }),
    );

    expect(mockedToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Trabalho publicado no Acervo",
        description: "Artigo em Revisão",
      }),
    );
  });

  it("submits manual article import to the API", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ count: 1, items: [] });

    mockedUseAdminEventsQuery.mockReturnValue({
      data: [adminEvent],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseImportArticlesMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderAdminPage(<AdminImportar />);

    const [titleInput, authorsInput] = screen.getAllByRole("textbox");

    fireEvent.change(titleInput, {
      target: { value: "Novo trabalho importado" },
    });
    fireEvent.change(authorsInput, {
      target: { value: "Ana Silva, Carlos Lima" },
    });

    const submitButton = screen.getByRole("button", { name: "Importar 1 trabalho" });
    await waitFor(() => expect(submitButton).toBeEnabled());

    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        eventId: "event-1",
        publishImmediately: false,
        invalidateOnSuccess: false,
        items: [
          expect.objectContaining({
            title: "Novo trabalho importado",
            authors: ["Ana Silva", "Carlos Lima"],
            area: "Geral",
            importedFrom: expect.stringMatching(/^Importa/i),
          }),
        ],
      }),
    );
  });

  it("extracts PDF metadata in batch, navigates the queue, and uploads each imported PDF", async () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const extractMutateAsync = vi.fn().mockImplementation(({ file }: { file: File }) => {
      if (file.name === "leucemia.pdf") {
        return Promise.resolve({
          title: "Leucemia Infantil",
          authors: ["Alice Cunha", "Barbara Oliveira"],
          emails: ["alice@acervo.edu", "barbara@acervo.edu"],
          abstract: "Resumo extraído do PDF.",
          suggestedArea: "Oncologia",
          areaSuggestionConfidence: "high",
          areaSuggestions: [
            { name: "Oncologia", score: 14, source: "event-theme" },
            { name: "Saúde", score: 8, source: "event-area" },
          ],
          suggestedCourses: ["Biomedicina"],
          courseSuggestionConfidence: "high",
          courseSuggestions: [{ name: "Biomedicina", score: 42, source: "explicit-text" }],
          pageCount: 5,
          warnings: [],
        });
      }

      return Promise.resolve({
        title: "Nanotecnologia Aplicada",
        authors: ["Pedro Souza"],
        emails: ["pedro@acervo.edu"],
        abstract: "Resumo do segundo PDF.",
        suggestedArea: "Nanotecnologia",
        areaSuggestionConfidence: "medium",
        areaSuggestions: [
          { name: "Nanotecnologia", score: 11, source: "catalog-area" },
          { name: "Tecnologia", score: 6, source: "event-theme" },
        ],
        suggestedCourses: [],
        courseSuggestions: [],
        pageCount: 7,
        warnings: [],
      });
    });
    const importMutateAsync = vi.fn().mockResolvedValue({
      count: 2,
      items: [{ id: "article-2" }, { id: "article-3" }],
    });
    const uploadMutateAsync = vi.fn().mockResolvedValue({});

    mockedUseAdminEventsQuery.mockReturnValue({
      data: [adminEvent],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseExtractArticlePdfMetadataMutation.mockReturnValue({
      mutateAsync: extractMutateAsync,
      isPending: false,
    } as never);
    mockedUseImportArticlesMutation.mockReturnValue({ mutateAsync: importMutateAsync, isPending: false } as never);
    mockedUseUploadArticlePdfMutation.mockReturnValue({ mutateAsync: uploadMutateAsync, isPending: false } as never);

    const { container } = renderAdminPage(<AdminImportar />);

    const pdfTab = screen.getByRole("tab", { name: /pdf/i });
    expect(screen.getByTestId("import-mode-card")).toContainElement(pdfTab);
    expect(screen.getByRole("tablist")).toHaveClass("gap-2");
    expect(pdfTab).toHaveClass("hover:bg-background/70", "hover:text-foreground");
    fireEvent.mouseDown(pdfTab);
    fireEvent.click(pdfTab);

    await waitFor(() => {
      expect(container.querySelector('input[type="file"][accept*=".pdf"]')).not.toBeNull();
    });

    const pdfInput = container.querySelector('input[type="file"][accept*=".pdf"]');
    const file = new File(["pdf-content"], "leucemia.pdf", { type: "application/pdf" });
    const secondFile = new File(["pdf-content-2"], "nano.pdf", { type: "application/pdf" });
    fireEvent.change(pdfInput!, { target: { files: [file, secondFile] } });

    fireEvent.click(screen.getByRole("button", { name: /Ler 2 PDFs pendentes/i }));

    await waitFor(() =>
      expect(extractMutateAsync).toHaveBeenCalledWith({
        file,
        eventId: "event-1",
      }),
    );

    await waitFor(() =>
      expect(extractMutateAsync).toHaveBeenCalledWith({
        file: secondFile,
        eventId: "event-1",
      }),
    );

    await waitFor(() => expect(screen.getByDisplayValue("Leucemia Infantil")).toBeInTheDocument());
    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(screen.getByDisplayValue("Alice Cunha, Barbara Oliveira")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Oncologia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1-5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover curso Biomedicina" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText("Próximo arquivo na revisão")[0]);
    await waitFor(() => expect(screen.getByDisplayValue("Nanotecnologia Aplicada")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Pedro Souza")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1-7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar 2 trabalhos e anexar PDFs/i }));

    await waitFor(() =>
      expect(importMutateAsync).toHaveBeenCalledWith({
        eventId: "event-1",
        publishImmediately: false,
        invalidateOnSuccess: false,
        items: [
          expect.objectContaining({
            title: "Leucemia Infantil",
            authors: ["Alice Cunha", "Barbara Oliveira"],
            area: "Oncologia",
            courses: ["Biomedicina"],
            pages: "1-5",
            modality: "Resumo Expandido",
            importedFrom: expect.stringMatching(/^Leitura/i),
          }),
          expect.objectContaining({
            title: "Nanotecnologia Aplicada",
            authors: ["Pedro Souza"],
            area: "Nanotecnologia",
            courses: [],
            pages: "1-7",
            modality: "Artigo Científico",
            importedFrom: expect.stringMatching(/^Leitura/i),
          }),
        ],
      }),
    );

    await waitFor(() =>
      expect(uploadMutateAsync).toHaveBeenCalledWith({
        id: "article-2",
        file,
        invalidateOnSuccess: false,
      }),
    );

    await waitFor(() =>
      expect(uploadMutateAsync).toHaveBeenCalledWith({
        id: "article-3",
        file: secondFile,
        invalidateOnSuccess: false,
      }),
    );
  });

  it("splits large PDF queues into bounded imports before uploading every file", async () => {
    const files = Array.from(
      { length: 26 },
      (_, index) => new File([`pdf-${index + 1}`], `trabalho-${index + 1}.pdf`, { type: "application/pdf" }),
    );
    const extractMutateAsync = vi.fn().mockImplementation(({ file }: { file: File }) =>
      Promise.resolve({
        title: file.name,
        authors: ["Ana Silva"],
        emails: [],
        abstract: "",
        areaSuggestions: [],
        suggestedCourses: [],
        courseSuggestions: [],
        pageCount: 1,
        warnings: [],
      }),
    );
    let importedArticleIndex = 0;
    const importMutateAsync = vi.fn().mockImplementation(({ items }: { items: unknown[] }) =>
      Promise.resolve({
        count: items.length,
        items: items.map(() => ({ id: `article-${++importedArticleIndex}` })),
      }),
    );
    const uploadMutateAsync = vi.fn().mockResolvedValue({});

    mockedUseAdminEventsQuery.mockReturnValue({
      data: [adminEvent],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseExtractArticlePdfMetadataMutation.mockReturnValue({
      mutateAsync: extractMutateAsync,
      isPending: false,
    } as never);
    mockedUseImportArticlesMutation.mockReturnValue({ mutateAsync: importMutateAsync, isPending: false } as never);
    mockedUseUploadArticlePdfMutation.mockReturnValue({ mutateAsync: uploadMutateAsync, isPending: false } as never);

    const { container } = renderAdminPage(<AdminImportar />);
    const pdfTab = screen.getByRole("tab", { name: /pdf/i });
    fireEvent.mouseDown(pdfTab);
    fireEvent.click(pdfTab);

    await waitFor(() => {
      expect(container.querySelector('input[type="file"][accept*=".pdf"]')).not.toBeNull();
    });
    const pdfInput = container.querySelector('input[type="file"][accept*=".pdf"]');
    fireEvent.change(pdfInput!, { target: { files } });
    fireEvent.click(screen.getByRole("button", { name: /Ler 26 PDFs pendentes/i }));

    await waitFor(() => expect(extractMutateAsync).toHaveBeenCalledTimes(26));
    const saveButton = screen.getByRole("button", { name: /Salvar 26 trabalhos e anexar PDFs/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(importMutateAsync).toHaveBeenCalledTimes(2));
    expect(importMutateAsync.mock.calls[0][0].items).toHaveLength(25);
    expect(importMutateAsync.mock.calls[1][0].items).toHaveLength(1);
    expect(importMutateAsync.mock.calls.every(([payload]) => payload.invalidateOnSuccess === false)).toBe(true);
    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledTimes(26));
    expect(uploadMutateAsync.mock.calls.every(([payload]) => payload.invalidateOnSuccess === false)).toBe(true);
  });
});
