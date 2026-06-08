import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ExcelFileIcon } from "@/components/ui/excel-file-icon";
import { SelectField } from "@/components/ui/select-field";
import { useAdminEventsQuery, useAreasQuery, useCoursesQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { downloadArticleReport } from "@/features/reports/api";
import { useArticleReportCountQuery } from "@/features/reports/hooks";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { triggerBrowserDownload } from "@/lib/article-download";
import { dateRangeFromIsoDates, dateRangeToIsoDates } from "@/lib/date-range";
import type { ArticleReportFilters } from "@/types/acervo";

const emptyFilters: ArticleReportFilters = {
  status: "all",
};
const allEventsValue = "__all_events__";
const allAreasValue = "__all_areas__";
const allCoursesValue = "__all_courses__";

export default function AdminRelatorios() {
  const { isAuthenticated } = useAuth();
  const { data: events = [] } = useAdminEventsQuery(isAuthenticated);
  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });
  const { data: courses = [] } = useCoursesQuery({ includeEmpty: true });
  const [filters, setFilters] = useState<ArticleReportFilters>(emptyFilters);
  const [isDownloading, setIsDownloading] = useState(false);
  const submissionDateRange = dateRangeFromIsoDates(filters.dateFrom, filters.dateTo);
  const reportCountQuery = useArticleReportCountQuery(filters, isAuthenticated);
  const reportCount = reportCountQuery.data?.count;
  const isReportEmpty = reportCount === 0;
  const isDownloadDisabled =
    isDownloading || reportCountQuery.isFetching || reportCountQuery.isError || reportCount === undefined || isReportEmpty;

  const updateFilter = (name: keyof ArticleReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [name]: value || undefined }));
  };

  const updateSubmissionDateRange = (range: Parameters<typeof dateRangeToIsoDates>[0]) => {
    setFilters((current) => ({ ...current, ...dateRangeToIsoDates(range) }));
  };

  const download = async () => {
    setIsDownloading(true);

    try {
      const blob = await downloadArticleReport(filters);
      triggerBrowserDownload(blob, `relatorio-acervo-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({
        title: "Relatório gerado",
        description: "A planilha foi baixada com resumos e trabalhos detalhados.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível gerar o relatório",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AdminShell title="Exportar relatórios">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ExcelFileIcon aria-hidden="true" className="h-7 w-7 shrink-0" data-testid="excel-report-icon" />
            Relatório Excel
          </CardTitle>
          <CardDescription>
            Gere uma planilha geral ou refine o resultado por área, curso, evento, status e período de submissão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {reportCountQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível verificar os trabalhos</AlertTitle>
              <AlertDescription>Atualize a página para tentar novamente antes de gerar o relatório.</AlertDescription>
            </Alert>
          ) : isReportEmpty ? (
            <Alert>
              <AlertTitle>Nenhum trabalho para exportar</AlertTitle>
              <AlertDescription>
                Cadastre uma publicação ou ajuste os filtros selecionados. Eventos sem publicações não geram linhas no
                relatório.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              {reportCountQuery.isFetching || reportCount === undefined
                ? "Verificando trabalhos disponíveis..."
                : `${reportCount} ${reportCount === 1 ? "trabalho disponível" : "trabalhos disponíveis"} para exportação.`}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              id="report-event"
              label="Evento"
              value={filters.eventId ?? allEventsValue}
              onValueChange={(value) => updateFilter("eventId", value === allEventsValue ? "" : value)}
              options={[
                { value: allEventsValue, label: "Todos os eventos" },
                ...events.map((event) => ({ value: event.id, label: event.title })),
              ]}
            />

            <SelectField
              id="report-area"
              label="Área"
              value={filters.area ?? allAreasValue}
              onValueChange={(value) => updateFilter("area", value === allAreasValue ? "" : value)}
              options={[
                { value: allAreasValue, label: "Todas as áreas" },
                ...areas.map((area) => ({ value: area.name, label: area.name })),
              ]}
            />

            <SelectField
              id="report-course"
              label="Curso"
              value={filters.course ?? allCoursesValue}
              onValueChange={(value) => updateFilter("course", value === allCoursesValue ? "" : value)}
              options={[
                { value: allCoursesValue, label: "Todos os cursos" },
                ...courses.map((course) => ({ value: course.name, label: course.name })),
              ]}
              className="md:col-span-2 xl:col-span-1"
            />

            <SelectField
              id="report-status"
              label="Status"
              value={filters.status ?? "all"}
              onValueChange={(value) => updateFilter("status", value)}
              options={[
                { value: "all", label: "Todos os status" },
                { value: "published", label: "Publicados" },
                { value: "draft", label: "Rascunhos" },
                { value: "archived", label: "Arquivados" },
              ]}
            />

            <div>
              <DateRangePicker
                id="report-submission-period"
                label="Período de submissão"
                value={submissionDateRange}
                onChange={updateSubmissionDateRange}
                placeholder="Todos os períodos de submissão"
                clearLabel="Remover filtro de período"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <Button type="button" onClick={download} disabled={isDownloadDisabled} className="w-full gap-2 bg-brand sm:w-auto">
              <FileSpreadsheet className="h-4 w-4" />
              {isDownloading ? "Gerando relatório..." : "Baixar relatório Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
