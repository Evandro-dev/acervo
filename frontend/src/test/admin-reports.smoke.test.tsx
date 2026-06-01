import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminRelatorios from "@/pages/admin/AdminRelatorios";
import { useAdminEventsQuery, useAreasQuery, useCoursesQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { downloadArticleReport } from "@/features/reports/api";
import { triggerBrowserDownload } from "@/lib/article-download";

vi.mock("@/features/acervo/hooks", () => ({
  useAdminEventsQuery: vi.fn(),
  useAreasQuery: vi.fn(),
  useCoursesQuery: vi.fn(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/reports/api", () => ({
  downloadArticleReport: vi.fn(),
}));

vi.mock("@/lib/article-download", () => ({
  triggerBrowserDownload: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAdminEventsQuery = vi.mocked(useAdminEventsQuery);
const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseCoursesQuery = vi.mocked(useCoursesQuery);
const mockedDownloadArticleReport = vi.mocked(downloadArticleReport);
const mockedTriggerBrowserDownload = vi.mocked(triggerBrowserDownload);

describe("AdminRelatorios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role: "ADMIN",
      },
      token: "token-1",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    mockedUseAdminEventsQuery.mockReturnValue({
      data: [{ id: "event-1", title: "Congresso UNA" }],
    } as never);
    mockedUseAreasQuery.mockReturnValue({
      data: [{ id: "area-1", name: "Saúde", articleCount: 2 }],
    } as never);
    mockedUseCoursesQuery.mockReturnValue({
      data: [{ id: "course-1", name: "Enfermagem", articleCount: 2 }],
    } as never);
    mockedDownloadArticleReport.mockResolvedValue(new Blob(["xlsx"]));
  });

  it("downloads an XLSX report using the selected filters", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminRelatorios />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "event-1" } });
    fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Saúde" } });
    fireEvent.change(screen.getByLabelText("Curso"), { target: { value: "Enfermagem" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });
    fireEvent.change(screen.getByLabelText("Submissão a partir de"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Baixar relatório Excel" }));

    await waitFor(() =>
      expect(mockedDownloadArticleReport).toHaveBeenCalledWith({
        eventId: "event-1",
        area: "Saúde",
        course: "Enfermagem",
        status: "published",
        dateFrom: "2026-01-01",
      }),
    );
    expect(mockedTriggerBrowserDownload).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.xlsx$/));
  });
});
