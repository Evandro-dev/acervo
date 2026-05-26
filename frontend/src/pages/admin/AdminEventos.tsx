import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, FileText, Plus, Pencil, FileEdit, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventCoverThumb } from "@/components/events/EventCoverThumb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QueryState } from "@/components/ui/query-state";
import { useAdminEventsQuery, useDeleteEventMutation } from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";

export default function AdminEventos() {
  const { isAuthenticated, user } = useAuth();
  const { data: events = [], isLoading, isError } = useAdminEventsQuery(isAuthenticated);
  const deleteEventMutation = useDeleteEventMutation();
  const [confirmDelete, setConfirmDelete] = useState<{
    eventId: string;
    title: string;
    articleCount: number;
  } | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const remove = async () => {
    if (!confirmDelete) return;

    try {
      await deleteEventMutation.mutateAsync(confirmDelete.eventId);
      toast({ title: "Evento removido", description: confirmDelete.title });
      setConfirmDelete(null);
    } catch (error) {
      toast({ title: "Falha ao remover evento", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <AdminShell title="Gerenciar eventos">
      <Button asChild className="mb-3 w-full gap-1.5 bg-brand text-primary-foreground hover:opacity-90">
        <Link to="/admin/eventos/novo">
          <Plus className="h-4 w-4" /> Novo evento
        </Link>
      </Button>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!events.length}
        loadingMessage="Carregando eventos administrativos..."
        errorMessage="Não foi possível carregar os eventos administrativos."
        emptyMessage="Nenhum evento encontrado."
      >
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="border-border/60 p-3 shadow-card">
              <div className="flex items-start gap-3">
                <EventCoverThumb cover={event.cover} title={event.title} className="h-12 w-12" iconClassName="h-5 w-5" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold leading-tight">{event.title}</h3>
                  <p className="text-[11px] text-muted-foreground">{event.date}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {event.type}
                    </Badge>
                    <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                      <Eye className="h-2.5 w-2.5" /> {event.viewCount ?? 0} visualizações
                    </Badge>
                    <Badge className="h-5 border-0 bg-success/15 px-1.5 text-[10px] text-success">
                      <FileText className="mr-1 h-2.5 w-2.5" /> {event.publishedCount} publicados
                    </Badge>
                    {event.draftCount > 0 && (
                      <Badge className="h-5 border-0 bg-warning/15 px-1.5 text-[10px] text-warning">
                        <FileEdit className="mr-1 h-2.5 w-2.5" /> {event.draftCount} rascunhos
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                  <Link to={`/admin/eventos/${event.id}`}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                </Button>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setConfirmDelete({
                        eventId: event.id,
                        title: event.title,
                        articleCount: event.articleCount,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" será excluído do Acervo
              {confirmDelete?.articleCount
                ? ` junto com ${confirmDelete.articleCount} trabalho(s) vinculado(s)`
                : ""}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={deleteEventMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEventMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
