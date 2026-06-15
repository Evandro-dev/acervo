import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminEventoForm from "@/pages/admin/AdminEventoForm";
import {
  useAreasQuery,
  useCreateEventMutation,
  useEventOptionsQuery,
  useEventQuery,
  useExtractCatalogPdfMetadataMutation,
  useRemoveUploadedEventRuleFileMutation,
  useUpdateEventMutation,
  useUploadEventCatalogPdfMutation,
  useUploadEventCoverImageMutation,
  useUploadEventRuleFileMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { renderCatalogPdfPreview } from "@/lib/catalog-pdf-preview";

vi.mock("@/features/acervo/hooks", () => ({
  useAreasQuery: vi.fn(),
  useCreateEventMutation: vi.fn(),
  useEventOptionsQuery: vi.fn(),
  useEventQuery: vi.fn(),
  useExtractCatalogPdfMetadataMutation: vi.fn(),
  useRemoveUploadedEventRuleFileMutation: vi.fn(),
  useUpdateEventMutation: vi.fn(),
  useUploadEventCatalogPdfMutation: vi.fn(),
  useUploadEventCoverImageMutation: vi.fn(),
  useUploadEventRuleFileMutation: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/catalog-pdf-preview", () => ({
  renderCatalogPdfPreview: vi.fn(),
}));

const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseCreateEventMutation = vi.mocked(useCreateEventMutation);
const mockedUseEventOptionsQuery = vi.mocked(useEventOptionsQuery);
const mockedUseEventQuery = vi.mocked(useEventQuery);
const mockedUseExtractCatalogPdfMetadataMutation = vi.mocked(useExtractCatalogPdfMetadataMutation);
const mockedUseRemoveUploadedEventRuleFileMutation = vi.mocked(useRemoveUploadedEventRuleFileMutation);
const mockedUseUpdateEventMutation = vi.mocked(useUpdateEventMutation);
const mockedUseUploadEventCatalogPdfMutation = vi.mocked(useUploadEventCatalogPdfMutation);
const mockedUseUploadEventCoverImageMutation = vi.mocked(useUploadEventCoverImageMutation);
const mockedUseUploadEventRuleFileMutation = vi.mocked(useUploadEventRuleFileMutation);
const mockedUseAuth = vi.mocked(useAuth);
const mockedToast = vi.mocked(toast);
const mockedRenderCatalogPdfPreview = vi.mocked(renderCatalogPdfPreview);

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

function fillRequiredEventFields(container: HTMLElement, title = "Congresso Completo") {
  fireEvent.change(screen.getByLabelText("Título"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByPlaceholderText("Digite ou escolha uma área"), {
    target: { value: "Tecnologia" },
  });
  fireEvent.change(screen.getByPlaceholderText("Contextualize o evento, objetivos, público e escopo."), {
    target: { value: "Apresentação completa do evento com detalhes suficientes para validação." },
  });
  fireEvent.change(container.querySelector('input[type="email"]')!, {
    target: { value: "congresso@ulife.com.br" },
  });
}

describe("AdminEventoForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue(adminSession);
    mockedUseAreasQuery.mockReturnValue({
      data: [{ id: "area-1", name: "Tecnologia", articleCount: 3 }],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseEventOptionsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseEventQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    mockedUseRemoveUploadedEventRuleFileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseExtractCatalogPdfMetadataMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventCatalogPdfMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("creates an event and uploads its cover image and rule documents before persisting final rules", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const updateMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadMutateAsync = vi.fn().mockResolvedValue({
      fileUrl: "http://localhost:10000/events/event-1/files/template-apresentacao.pptx",
    });
    const uploadCoverMutateAsync = vi.fn().mockResolvedValue({
      coverUrl: "http://localhost:10000/events/event-1/cover/capa-evento.jpg",
    });

    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: uploadCoverMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: uploadMutateAsync,
      isPending: false,
    } as never);

    const { container } = render(
      <MemoryRouter>
        <AdminEventoForm />
      </MemoryRouter>,
    );

    const titleInput = container.querySelector("input[required]") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Congresso Completo" } });

    fireEvent.change(screen.getByPlaceholderText("Digite ou escolha uma área"), {
      target: { value: "Tecnologia" },
    });
    fireEvent.change(screen.getByPlaceholderText("Contextualize o evento, objetivos, público e escopo."), {
      target: { value: "Apresentação completa do evento com detalhes suficientes para validação." },
    });

    const coverInput = container.querySelector('input[type="file"][accept*="image/"]') as HTMLInputElement;
    const coverFile = new File(["image-content"], "capa-evento.jpg", { type: "image/jpeg" });
    fireEvent.change(coverInput, { target: { files: [coverFile] } });

    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: "congresso@acervo.edu" },
    });

    fireEvent.change(screen.getByPlaceholderText("Área Temática 1"), {
      target: { value: "Tecnologia e Inovação" },
    });

    fireEvent.change(screen.getByPlaceholderText("Profa. Dra. Roberta Manfron"), {
      target: { value: "Profa. Dra. Roberta Manfron" },
    });

    fireEvent.change(screen.getByPlaceholderText("Normas de submissão"), {
      target: { value: "Normas de submissão" },
    });

    expect(screen.getByRole("group", { name: "Origem do arquivo da norma" })).toHaveClass("gap-1", "bg-muted/35");
    expect(screen.getByRole("button", { name: "Enviar arquivo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Usar link externo" })).toHaveClass(
      "hover:bg-background/95",
      "hover:text-foreground",
    );

    const ruleDocumentInput = container.querySelector('input[type="file"][accept*=".pptx"]') as HTMLInputElement;
    const file = new File(["slides"], "template-apresentacao.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    fireEvent.change(ruleDocumentInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Congresso Completo",
          area: "Tecnologia",
          presentation: "Apresentação completa do evento com detalhes suficientes para validação.",
          themes: ["Tecnologia e Inovação"],
          committee: [{ name: "Profa. Dra. Roberta Manfron", role: "Organizadora" }],
          rules: [],
          contact: { email: "congresso@acervo.edu", phone: undefined },
        }),
      ),
    );

    await waitFor(() =>
      expect(uploadCoverMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        file: coverFile,
      }),
    );

    await waitFor(() =>
      expect(uploadMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        file,
      }),
    );

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        payload: expect.objectContaining({
          coverUrl: "http://localhost:10000/events/event-1/cover/capa-evento.jpg",
          rules: [
            {
              title: "Normas de submissão",
              file: "http://localhost:10000/events/event-1/files/template-apresentacao.pptx",
            },
          ],
        }),
      }),
    );

    expect(mockedToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Evento criado",
        description: "Congresso Completo",
      }),
    );
  });

  it("removes the persisted cover when an edited event is saved without its current image", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadCoverMutateAsync = vi.fn();

    mockedUseEventQuery.mockReturnValue({
      data: {
        id: "event-1",
        slug: "congresso-completo",
        title: "Congresso Completo",
        edition: "1ª Edição",
        year: 2026,
        date: "15 de junho de 2026",
        area: "Tecnologia",
        type: "Congresso",
        cover: "http://localhost:10000/events/event-1/cover/current.png",
        presentation: "Apresentação completa do evento com detalhes suficientes.",
        themes: [],
        committee: [],
        rules: [],
        previousEditions: [],
        contact: { email: "congresso@acervo.edu" },
        catalog: {},
      },
      isLoading: false,
      isError: false,
    } as never);
    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: uploadCoverMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    render(
      <MemoryRouter
        initialEntries={["/admin/eventos/event-1"]}
      >
        <Routes>
          <Route path="/admin/eventos/:id" element={<AdminEventoForm />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover imagem do evento" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        payload: expect.objectContaining({ coverUrl: null }),
      }),
    );
    expect(uploadCoverMutateAsync).not.toHaveBeenCalled();
  });

  it("shows the normalized event type when editing an event saved with legacy casing", async () => {
    mockedUseEventQuery.mockReturnValue({
      data: {
        id: "event-1",
        slug: "expo-una-2025-2",
        title: "EXPO UNA 2025/2",
        edition: "1ª Edição",
        year: 2025,
        date: "1 a 5 de dezembro de 2025",
        area: "Troca, inovação e impacto social",
        type: "expo",
        cover: null,
        presentation: "Apresentação completa do evento com detalhes suficientes.",
        themes: [],
        committee: [],
        rules: [],
        previousEditions: [],
        contact: { email: "expo@ulife.com.br" },
        catalog: {},
      },
      isLoading: false,
      isError: false,
    } as never);
    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    const { container } = render(
      <MemoryRouter initialEntries={["/admin/eventos/event-1"]}>
        <Routes>
          <Route path="/admin/eventos/:id" element={<AdminEventoForm />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(container.querySelector("#event-type")).toHaveTextContent("Expo"),
    );
  });

  it("cleans newly uploaded rule documents when the final event update fails", async () => {
    const fileUrl = "http://localhost:10000/events/event-1/files/template-apresentacao.pptx";
    const cleanupMutateAsync = vi.fn().mockResolvedValue(undefined);

    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "event-1", title: "Congresso Completo" }),
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("Falha ao concluir atualização")),
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ fileUrl }),
      isPending: false,
    } as never);
    mockedUseRemoveUploadedEventRuleFileMutation.mockReturnValue({
      mutateAsync: cleanupMutateAsync,
      isPending: false,
    } as never);

    const { container } = render(
      <MemoryRouter>
        <AdminEventoForm />
      </MemoryRouter>,
    );

    fireEvent.change(container.querySelector("input[required]")!, {
      target: { value: "Congresso Completo" },
    });
    fireEvent.change(screen.getByPlaceholderText("Digite ou escolha uma área"), {
      target: { value: "Tecnologia" },
    });
    fireEvent.change(screen.getByPlaceholderText("Contextualize o evento, objetivos, público e escopo."), {
      target: { value: "Apresentação completa do evento com detalhes suficientes." },
    });
    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: "congresso@acervo.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText("Normas de submissão"), {
      target: { value: "Template de apresentação" },
    });

    const ruleDocumentInput = container.querySelector('input[type="file"][accept*=".pptx"]') as HTMLInputElement;
    fireEvent.change(ruleDocumentInput, {
      target: {
        files: [
          new File(["slides"], "template-apresentacao.pptx", {
            type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(cleanupMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        fileUrl,
      }),
    );
    expect(mockedToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Evento salvo parcialmente",
        variant: "destructive",
      }),
    );
  });

  it("shows persisted rule documents in edit mode and keeps them without uploading when unchanged", async () => {
    const ruleFileUrl =
      "http://localhost:10000/events/event-1/files/1780355176739-edital-a1b2c3d4.pdf";
    const updateMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadRuleMutateAsync = vi.fn();

    mockedUseEventQuery.mockReturnValue({
      data: {
        id: "event-1",
        slug: "congresso-completo",
        title: "Congresso Completo",
        edition: "1ª Edição",
        year: 2026,
        date: "15 de junho de 2026",
        area: "Tecnologia",
        type: "Congresso",
        cover: null,
        presentation: "Apresentação completa do evento com detalhes suficientes.",
        themes: [],
        committee: [],
        rules: [{ title: "Edital", file: ruleFileUrl }],
        previousEditions: [],
        contact: { email: "congresso@ulife.com.br" },
        catalog: {},
      },
      isLoading: false,
      isError: false,
    } as never);
    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: uploadRuleMutateAsync,
      isPending: false,
    } as never);

    render(
      <MemoryRouter initialEntries={["/admin/eventos/event-1"]}>
        <Routes>
          <Route path="/admin/eventos/:id" element={<AdminEventoForm />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("edital.pdf")).toBeInTheDocument();
    expect(screen.getByText("Arquivo atual vinculado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir/i })).toHaveAttribute(
      "href",
      ruleFileUrl,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        payload: expect.objectContaining({
          rules: [{ title: "Edital", file: ruleFileUrl }],
        }),
      }),
    );
    expect(uploadRuleMutateAsync).not.toHaveBeenCalled();
  });

  it("uploads a replacement rule document only after saving the edited event", async () => {
    const ruleFileUrl =
      "http://localhost:10000/events/event-1/files/1780355176739-edital-a1b2c3d4.pdf";
    const replacementFileUrl =
      "http://localhost:10000/events/event-1/files/1780355176740-edital-atualizado-b2c3d4e5.pdf";
    const replacementFile = new File(["novo edital"], "edital-atualizado.pdf", {
      type: "application/pdf",
    });
    const updateMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadRuleMutateAsync = vi.fn().mockResolvedValue({
      fileUrl: replacementFileUrl,
    });

    mockedUseEventQuery.mockReturnValue({
      data: {
        id: "event-1",
        slug: "congresso-completo",
        title: "Congresso Completo",
        edition: "1ª Edição",
        year: 2026,
        date: "15 de junho de 2026",
        area: "Tecnologia",
        type: "Congresso",
        cover: null,
        presentation: "Apresentação completa do evento com detalhes suficientes.",
        themes: [],
        committee: [],
        rules: [{ title: "Edital", file: ruleFileUrl }],
        previousEditions: [],
        contact: { email: "congresso@ulife.com.br" },
        catalog: {},
      },
      isLoading: false,
      isError: false,
    } as never);
    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: uploadRuleMutateAsync,
      isPending: false,
    } as never);

    render(
      <MemoryRouter initialEntries={["/admin/eventos/event-1"]}>
        <Routes>
          <Route path="/admin/eventos/:id" element={<AdminEventoForm />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Trocar arquivo da norma"), {
      target: { files: [replacementFile] },
    });

    expect(screen.getByText("edital-atualizado.pdf")).toBeInTheDocument();
    expect(uploadRuleMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(uploadRuleMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        file: replacementFile,
      }),
    );
    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenLastCalledWith({
        id: "event-1",
        payload: expect.objectContaining({
          rules: [{ title: "Edital", file: replacementFileUrl }],
        }),
      }),
    );
  });

  it("renders a temporary catalog PDF preview and only uploads the catalog files after saving the event", async () => {
    const pdfFile = new File(["%PDF-1.7\n%%EOF"], "ficha.pdf", {
      type: "application/pdf",
    });
    const imageBlob = new Blob(["png-preview"], { type: "image/png" });
    const imageFile = new File([imageBlob], "ficha.png", {
      type: "image/png",
    });
    const extractCatalogMutateAsync = vi.fn().mockResolvedValue({
      text: "Dados Internacionais de Catalogação na Publicação\nISBN 978-65-02-14535-7",
      isbn: "978-65-02-14535-7",
      pageCount: 1,
      warnings: [],
    });
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadCatalogMutateAsync = vi.fn().mockResolvedValue({
      catalogPdfUrl: "/events/event-1/catalog/files/ficha.pdf",
      catalogImageUrl: "/events/event-1/catalog/files/ficha.png",
      text: "Dados Internacionais de Catalogação na Publicação",
      isbn: "978-65-02-14535-7",
      pageCount: 1,
      warnings: [],
    });

    mockedUseExtractCatalogPdfMetadataMutation.mockReturnValue({
      mutateAsync: extractCatalogMutateAsync,
      isPending: false,
    } as never);
    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventCatalogPdfMutation.mockReturnValue({
      mutateAsync: uploadCatalogMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedRenderCatalogPdfPreview.mockResolvedValue({
      dataUrl: "data:image/png;base64,preview",
      imageFile,
      blob: imageBlob,
      width: 700,
      height: 900,
      pageNumber: 1,
      pageCount: 1,
    });

    const { container } = render(
      <MemoryRouter>
        <AdminEventoForm />
      </MemoryRouter>,
    );

    fillRequiredEventFields(container);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    fireEvent.change(screen.getByLabelText("Selecionar PDF da ficha"), {
      target: { files: [pdfFile] },
    });

    await waitFor(() =>
      expect(extractCatalogMutateAsync).toHaveBeenCalledWith({ file: pdfFile }),
    );
    await waitFor(() =>
      expect(mockedRenderCatalogPdfPreview).toHaveBeenCalledWith(pdfFile, {
        scale: 2,
      }),
    );
    expect(uploadCatalogMutateAsync).not.toHaveBeenCalled();
    expect(
      await screen.findByAltText("Prévia da ficha catalográfica"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          catalog: expect.objectContaining({
            isbn: "978-65-02-14535-7",
            text: "",
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(uploadCatalogMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        pdfFile,
        imageFile,
      }),
    );
  });

  it("removes persisted catalog PDF and image when an edited event is saved after catalog removal", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadCatalogMutateAsync = vi.fn();

    mockedUseEventQuery.mockReturnValue({
      data: {
        id: "event-1",
        slug: "congresso-completo",
        title: "Congresso Completo",
        edition: "1ª Edição",
        year: 2026,
        date: "15 de junho de 2026",
        area: "Tecnologia",
        type: "Congresso",
        cover: null,
        presentation: "Apresentação completa do evento com detalhes suficientes.",
        themes: [],
        committee: [],
        rules: [],
        previousEditions: [],
        contact: { email: "congresso@ulife.com.br" },
        catalog: {
          isbn: "978-65-02-14535-7",
          text: "",
          pdfUrl: "/events/event-1/catalog/files/ficha.pdf",
          imageUrl: "/events/event-1/catalog/files/ficha.png",
        },
      },
      isLoading: false,
      isError: false,
    } as never);
    mockedUseCreateEventMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateEventMutation.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCatalogPdfMutation.mockReturnValue({
      mutateAsync: uploadCatalogMutateAsync,
      isPending: false,
    } as never);
    mockedUseUploadEventCoverImageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUploadEventRuleFileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    render(
      <MemoryRouter initialEntries={["/admin/eventos/event-1"]}>
        <Routes>
          <Route path="/admin/eventos/:id" element={<AdminEventoForm />} />
        </Routes>
      </MemoryRouter>,
    );

    const [removeCatalogButton] = await screen.findAllByRole("button", {
      name: "Remover ficha catalográfica",
    });
    fireEvent.click(removeCatalogButton);
    fireEvent.click(screen.getByRole("button", { name: "Salvar evento completo" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "event-1",
        payload: expect.objectContaining({
          catalog: expect.objectContaining({
            text: "",
            pdfUrl: null,
            imageUrl: null,
          }),
        }),
      }),
    );
    expect(uploadCatalogMutateAsync).not.toHaveBeenCalled();
  });
});
