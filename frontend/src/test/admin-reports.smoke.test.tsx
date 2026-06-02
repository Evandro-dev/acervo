import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminRelatorios from "@/pages/admin/AdminRelatorios";
import { useAdminEventsQuery, useAreasQuery, useCoursesQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { downloadArticleReport } from "@/features/reports/api";
import { useArticleReportCountQuery } from "@/features/reports/hooks";
import { triggerBrowserDownload } from "@/lib/article-download";

vi.mock("@/features/acervo/hooks", () => ({
  useAdminEventsQuery: vi.fn(),
  useAreasQuery: vi.fn(),
  useCoursesQuery: vi.fn(),
}));

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: ({
    label,
    onChange,
  }: {
    label: string;
    onChange: (range: { from: Date; to: Date }) => void;
  }) => (
    <button type="button" onClick={() => onChange({ from: new Date(2026, 0, 1), to: new Date(2026, 5, 30) })}>
      {label}
    </button>
  ),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/reports/api", () => ({
  downloadArticleReport: vi.fn(),
}));

vi.mock("@/features/reports/hooks", () => ({
  useArticleReportCountQuery: vi.fn(),
}));

vi.mock("@/lib/article-download", () => ({
  triggerBrowserDownload: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAdminEventsQuery = vi.mocked(useAdminEventsQuery);
const mockedUseAreasQuery = vi.mocked(useAreasQuery);
const mockedUseCoursesQuery = vi.mocked(useCoursesQuery);
const mockedDownloadArticleReport = vi.mocked(downloadArticleReport);
const mockedUseArticleReportCountQuery = vi.mocked(useArticleReportCountQuery);
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
    mockedUseArticleReportCountQuery.mockReturnValue({
      data: { count: 2 },
      isError: false,
      isFetching: false,
    } as never);
  });

  it("downloads an XLSX report using the selected filters", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminRelatorios />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("excel-report-icon")).toHaveAttribute("viewBox", "0 0 32 32");
    expect(screen.getByLabelText("Curso").parentElement).toHaveClass("md:col-span-2", "xl:col-span-1");
    expect(screen.getByRole("button", { name: "Baixar relatório Excel" }).parentElement).toHaveClass("justify-center");
    fireEvent.click(screen.getByLabelText("Evento"));
    fireEvent.click(screen.getByRole("option", { name: "Congresso UNA" }));
    fireEvent.click(screen.getByLabelText("Área"));
    fireEvent.click(screen.getByRole("option", { name: "Saúde" }));
    fireEvent.click(screen.getByLabelText("Curso"));
    expect(document.querySelector('[data-slot="select-scroll-viewport"]')).toHaveClass(
      "acervo-dropdown-scrollbar",
      "overflow-y-auto",
    );
    fireEvent.click(screen.getByRole("option", { name: "Enfermagem" }));
    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(screen.getByRole("option", { name: "Publicados" }));
    fireEvent.click(screen.getByRole("button", { name: "Período de submissão" }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar relatório Excel" }));

    await waitFor(() =>
      expect(mockedDownloadArticleReport).toHaveBeenCalledWith({
        eventId: "event-1",
        area: "Saúde",
        course: "Enfermagem",
        status: "published",
        dateFrom: "2026-01-01",
        dateTo: "2026-06-30",
      }),
    );
    expect(mockedTriggerBrowserDownload).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.xlsx$/));
  });

  it("disables export when no work matches the selected filters", () => {
    mockedUseArticleReportCountQuery.mockReturnValue({
      data: { count: 0 },
      isError: false,
      isFetching: false,
    } as never);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminRelatorios />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Baixar relatório Excel" })).toBeDisabled();
    expect(screen.getByText("Nenhum trabalho para exportar")).toBeInTheDocument();
    expect(screen.getByText(/Eventos sem publicações não geram linhas no relatório/)).toBeInTheDocument();
  });
});
