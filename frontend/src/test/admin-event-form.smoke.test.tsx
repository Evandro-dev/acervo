import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminEventoForm from "@/pages/admin/AdminEventoForm";
import {
  useAdminEventsQuery,
  useAreasQuery,
  useCreateEventMutation,
  useEventQuery,
  useUpdateEventMutation,
  useUploadEventCoverImageMutation,
  useUploadEventRuleFileMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";

vi.mock("@/features/acervo/hooks", () => ({
  useAdminEventsQuery: vi.fn(),
  useAreasQuery: vi.fn(),
  useCreateEventMutation: vi.fn(),
  useEventQuery: vi.fn(),
  useUpdateEventMutation: vi.fn(),
  useUploadEventCoverImageMutation: vi.fn(),
  useUploadEventRuleFileMutation: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const mockedUseAdminEventsQuery = vi.mocked(useAdminEventsQuery);
const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseCreateEventMutation = vi.mocked(useCreateEventMutation);
const mockedUseEventQuery = vi.mocked(useEventQuery);
const mockedUseUpdateEventMutation = vi.mocked(useUpdateEventMutation);
const mockedUseUploadEventCoverImageMutation = vi.mocked(useUploadEventCoverImageMutation);
const mockedUseUploadEventRuleFileMutation = vi.mocked(useUploadEventRuleFileMutation);
const mockedUseAuth = vi.mocked(useAuth);
const mockedToast = vi.mocked(toast);

const adminSession = {
  user: {
    id: "user-1",
    name: "Admin",
    email: "admin@acervo.edu",
    role: "ADMIN" as const,
  },
  token: "token-1",
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

describe("AdminEventoForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue(adminSession);
    mockedUseAreasQuery.mockReturnValue({
      data: [{ id: "area-1", name: "Tecnologia", articleCount: 3 }],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseAdminEventsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    mockedUseEventQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
  });

  it("creates an event and uploads its cover image and rule PDFs before persisting final rules", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const updateMutateAsync = vi.fn().mockResolvedValue({
      id: "event-1",
      title: "Congresso Completo",
    });
    const uploadMutateAsync = vi.fn().mockResolvedValue({
      fileUrl: "http://localhost:10000/events/event-1/files/norma-submissao.pdf",
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

    const pdfInput = container.querySelector('input[type="file"][accept*=".pdf"]') as HTMLInputElement;
    const file = new File(["pdf-content"], "norma-submissao.pdf", { type: "application/pdf" });
    fireEvent.change(pdfInput, { target: { files: [file] } });

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
              file: "http://localhost:10000/events/event-1/files/norma-submissao.pdf",
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
});
