import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventoDetalhe from "@/pages/EventoDetalhe";
import {
  useEventQuery,
  usePublishedArticlesQuery,
  useTrackEventViewMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/acervo/hooks", () => ({
  useEventQuery: vi.fn(),
  usePublishedArticlesQuery: vi.fn(),
  useTrackEventViewMutation: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseEventQuery = vi.mocked(useEventQuery);
const mockedUsePublishedArticlesQuery = vi.mocked(usePublishedArticlesQuery);
const mockedUseTrackEventViewMutation = vi.mocked(useTrackEventViewMutation);
const mockedUseAuth = vi.mocked(useAuth);

function paginated<T>(items: T[], total = items.length, page = 1, pageSize = 12) {
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function buildEvent(catalog: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    slug: "expo-una-2025",
    title: "EXPO UNA 2025",
    edition: "1ª Edição",
    year: 2025,
    date: "1 a 5 de dezembro de 2025",
    area: "Troca, inovação e impacto social",
    type: "Expo",
    presentation: "Apresentação pública do evento.",
    themes: [],
    committee: [],
    catalog,
    rules: [
      {
        title: "Template de apresentação",
        file: "https://example.com/template-apresentacao.pptx",
      },
    ],
    previousEditions: [],
    contact: { email: "evento@ulife.com.br" },
    articleCount: 0,
    publishedCount: 0,
    draftCount: 0,
    archivedCount: 0,
    articles: [],
  };
}

function mockEventQuery(catalog: Record<string, unknown> = {}) {
  mockedUseEventQuery.mockReturnValue({
    data: buildEvent(catalog),
    isLoading: false,
    isError: false,
  } as never);
}

function renderEventDetails() {
  render(
    <MemoryRouter initialEntries={["/eventos/expo-una-2025"]}>
      <Routes>
        <Route path="/eventos/:id" element={<EventoDetalhe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function openAboutCatalogSection() {
  const aboutTab = screen.getByRole("tab", { name: "Sobre" });
  fireEvent.mouseDown(aboutTab);
  fireEvent.click(aboutTab);
  fireEvent.click(screen.getByRole("button", { name: "Ficha Catalográfica" }));
}

describe("EventoDetalhe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    mockedUseTrackEventViewMutation.mockReturnValue({ mutate: vi.fn() } as never);
    mockedUsePublishedArticlesQuery.mockReturnValue({
      data: paginated([]),
      isLoading: false,
      isError: false,
    } as never);
  });

  it("uses the branded administrative navigation style for the active tab", () => {
    mockEventQuery();
    renderEventDetails();

    const activeTab = screen.getByRole("tab", { name: "Apresentação" });
    expect(activeTab).toHaveAttribute("data-state", "active");
    expect(activeTab).toHaveClass("bg-brand", "!text-primary-foreground", "shadow-sm");

    const publicationsTab = screen.getByRole("tab", { name: "Publicações" });
    fireEvent.mouseDown(publicationsTab);
    fireEvent.click(publicationsTab);
    expect(publicationsTab).toHaveAttribute("data-state", "active");
    expect(publicationsTab).toHaveClass("bg-brand", "!text-primary-foreground", "shadow-sm");
    expect(activeTab).toHaveClass("text-foreground/70", "hover:bg-muted");

    const aboutTab = screen.getByRole("tab", { name: "Sobre" });
    fireEvent.mouseDown(aboutTab);
    fireEvent.click(aboutTab);
    fireEvent.click(screen.getByRole("button", { name: "Normas" }));
    expect(screen.getByRole("button", { name: "PowerPoint" })).toBeInTheDocument();
  });

  it("loads event publications through the paginated articles query", async () => {
    const article = {
      id: "article-1",
      title: "Tecnologia e inovação no ensino contemporâneo",
      authors: ["Carlos Pereira"],
      authorProfiles: [],
      area: "Tecnologia",
      courses: [],
      abstract: "Resumo do trabalho publicado.",
      pages: "1-5",
      status: "published",
      eventId: "event-1",
      eventSlug: "expo-una-2025",
      eventTitle: "EXPO UNA 2025",
      eventYear: 2025,
    };

    mockEventQuery();
    mockedUsePublishedArticlesQuery.mockImplementation((filters) => ({
      data: paginated(
        [article],
        13,
        filters?.page ?? 1,
        filters?.pageSize ?? 12,
      ),
      isLoading: false,
      isError: false,
    }) as never);

    renderEventDetails();

    expect(mockedUseEventQuery).toHaveBeenCalledWith(
      "expo-una-2025",
      "none",
      expect.objectContaining({
        refetchOnMount: "always",
      }),
    );
    expect(mockedUsePublishedArticlesQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        page: 1,
        pageSize: 12,
      }),
      { enabled: true },
    );

    const publicationsTab = screen.getByRole("tab", { name: "Publicações" });
    fireEvent.mouseDown(publicationsTab);
    fireEvent.click(publicationsTab);

    expect(screen.getByText("13 Publicações")).toBeInTheDocument();
    expect(screen.getByText(article.title)).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1-12 de 13")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Próxima/i }));

    await waitFor(() =>
      expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          eventId: "event-1",
          page: 2,
          pageSize: 12,
        }),
        { enabled: true },
      ),
    );
  });

  it("shows the generated catalog image in the about tab when the event catalog was uploaded from PDF", () => {
    mockEventQuery({
      isbn: "978-65-02-14535-7",
      pdfUrl: "/events/event-1/catalog/files/ficha.pdf",
      imageUrl: "/events/event-1/catalog/files/ficha.png",
    });
    renderEventDetails();

    openAboutCatalogSection();

    const image = screen.getByRole("img", { name: "Ficha catalográfica" });
    expect(image).toHaveAttribute(
      "src",
      "http://localhost:10000/events/event-1/catalog/files/ficha.png",
    );
    expect(image).toHaveAttribute("draggable", "false");
    expect(screen.queryByText("Abrir PDF")).not.toBeInTheDocument();
  });

  it("falls back to the catalog PDF link when no generated catalog image exists", () => {
    mockEventQuery({
      pdfUrl: "/events/event-1/catalog/files/ficha.pdf",
    });
    renderEventDetails();

    openAboutCatalogSection();

    expect(
      screen.getByText("A ficha catalográfica está vinculada como PDF."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir PDF" })).toHaveAttribute(
      "href",
      "http://localhost:10000/events/event-1/catalog/files/ficha.pdf",
    );
  });

  it("shows the manual catalog text when the event has no catalog files", () => {
    mockEventQuery({
      text: "Ficha catalográfica manual\nISBN 978-65-02-14535-7",
    });
    renderEventDetails();

    openAboutCatalogSection();

    expect(screen.getByText(/Ficha catalográfica manual/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir PDF" })).not.toBeInTheDocument();
  });
});
