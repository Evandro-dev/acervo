import { useState } from "react";
import { FileSpreadsheet, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminEventsQuery, useAreasQuery, useCoursesQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { downloadArticleReport } from "@/features/reports/api";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { triggerBrowserDownload } from "@/lib/article-download";
import type { ArticleReportFilters } from "@/types/acervo";

const emptyFilters: ArticleReportFilters = {
  status: "all",
};

export default function AdminRelatorios() {
  const { isAuthenticated } = useAuth();
  const { data: events = [] } = useAdminEventsQuery(isAuthenticated);
  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });
  const { data: courses = [] } = useCoursesQuery({ includeEmpty: true });
  const [filters, setFilters] = useState<ArticleReportFilters>(emptyFilters);
  const [isDownloading, setIsDownloading] = useState(false);

  const updateFilter = (name: keyof ArticleReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [name]: value || undefined }));
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
            <FileSpreadsheet className="h-5 w-5 text-brand" />
            Relatório Excel
          </CardTitle>
          <CardDescription>
            Gere uma planilha geral ou refine o resultado por área, curso, evento, status e período de submissão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert className="border-brand/15 bg-brand/5">
            <ShieldCheck className="h-4 w-4 text-brand" />
            <AlertTitle>Arquivo completo</AlertTitle>
            <AlertDescription>
              O Excel contém visão geral, resumo numérico por área, resumo numérico por curso e trabalhos detalhados.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="report-event">Evento</Label>
              <select
                id="report-event"
                value={filters.eventId ?? ""}
                onChange={(event) => updateFilter("eventId", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os eventos</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-area">Área</Label>
              <select
                id="report-area"
                value={filters.area ?? ""}
                onChange={(event) => updateFilter("area", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as áreas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.name}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-course">Curso</Label>
              <select
                id="report-course"
                value={filters.course ?? ""}
                onChange={(event) => updateFilter("course", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os cursos</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.name}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-status">Status</Label>
              <select
                id="report-status"
                value={filters.status ?? "all"}
                onChange={(event) => updateFilter("status", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="published">Publicados</option>
                <option value="draft">Rascunhos</option>
                <option value="archived">Arquivados</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-date-from">Submissão a partir de</Label>
              <Input
                id="report-date-from"
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-date-to">Submissão até</Label>
              <Input
                id="report-date-to"
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
              />
            </div>
          </div>

          <Button type="button" onClick={download} disabled={isDownloading} className="w-full gap-2 bg-brand sm:w-auto">
            <FileSpreadsheet className="h-4 w-4" />
            {isDownloading ? "Gerando relatório..." : "Baixar relatório Excel"}
          </Button>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
