import { Link } from "react-router-dom";
import type { ComponentType } from "react";
import {
  Archive,
  BookOpen,
  DownloadCloud,
  FileCheck2,
  FileText,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { useAdminDashboardSummaryQuery } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import type { AdminDashboardSummary } from "@/features/acervo/api";

const EMPTY_DASHBOARD_SUMMARY: AdminDashboardSummary = {
  eventCount: 0,
  publishedCount: 0,
  draftCount: 0,
  archivedCount: 0,
};

export default function AdminDashboard() {
  const { isAuthenticated } = useAuth();

  const {
    data: summary = EMPTY_DASHBOARD_SUMMARY,
    isLoading,
    isError,
  } = useAdminDashboardSummaryQuery(isAuthenticated);

  return (
    <AdminShell title="Dashboard">
      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={summary.eventCount === 0}
        loadingMessage="Carregando o dashboard administrativo..."
        errorMessage="Não foi possível carregar o dashboard administrativo."
        emptyMessage="Cadastre um evento para começar a administrar o Acervo."
      >
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Eventos" value={summary.eventCount} icon={BookOpen} />
            <Stat
              label="Publicações"
              value={summary.publishedCount}
              icon={FileCheck2}
              accent="success"
            />
            <Stat
              label="Rascunhos"
              value={summary.draftCount}
              icon={FileText}
              accent="warning"
            />
            <Stat
              label="Arquivados"
              value={summary.archivedCount}
              icon={Archive}
              accent="muted"
            />
          </div>

          <h2 className="mb-2 mt-5 text-sm font-bold text-brand">
            Ações rápidas
          </h2>

          <div className="space-y-2">
            <Link
              to="/admin/importar"
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 shadow-card"
            >
              <div className="flex items-center gap-3">
                <DownloadCloud className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-bold">Importar trabalhos</div>
                  <div className="text-xs text-muted-foreground">
                    Trazer artigos externos
                  </div>
                </div>
              </div>
            </Link>

            <Link
              to="/admin/publicacoes"
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 shadow-card"
            >
              <div className="flex items-center gap-3">
                <FileCheck2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-bold">
                    Curadoria de publicações
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {summary.draftCount} rascunhos prontos para publicar
                  </div>
                </div>
              </div>

              {summary.draftCount > 0 && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  {summary.draftCount}
                </span>
              )}
            </Link>

            <Link
              to="/admin/eventos"
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 shadow-card"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-bold">Gerenciar eventos</div>
                  <div className="text-xs text-muted-foreground">
                    Editar metadados e organizar Acervo
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">
              Acervo é um repositório.
            </strong>{" "}
            O papel da curadoria é importar, organizar e publicar os trabalhos
            aqui.
          </div>
        </>
      </QueryState>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  accent?: "success" | "warning" | "muted";
}) {
  const colors = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    muted: "bg-muted text-muted-foreground",
  } satisfies Record<NonNullable<typeof accent>, string>;

  const colorClass = accent
    ? colors[accent]
    : "bg-brand-soft text-primary-dark";

  return (
    <Card className="border-border/60 p-3 shadow-card">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-md ${colorClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </Card>
  );
}
