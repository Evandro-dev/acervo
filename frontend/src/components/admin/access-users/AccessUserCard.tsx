import { Pencil, UserCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserAccount } from "@/types/acervo";

type AccessUserCardProps = {
  accessUser: UserAccount;
  isCurrentUser: boolean;
  onEdit: (accessUser: UserAccount) => void;
  onToggleActive: (accessUser: UserAccount) => void;
};

export function AccessUserCard({ accessUser, isCurrentUser, onEdit, onToggleActive }: AccessUserCardProps) {
  const isActive = accessUser.isActive !== false;

  return (
    <li className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{accessUser.name}</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">{accessUser.email}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant={accessUser.role === "ADMIN" ? "default" : "secondary"}>
            {accessUser.role === "ADMIN" ? "Administrador" : "Coordenador"}
          </Badge>
          <Badge
            variant="outline"
            className={isActive ? "border-success/40 bg-success/10 text-success" : "border-muted-foreground/30 text-muted-foreground"}
          >
            {isActive ? "Ativa" : "Desativada"}
          </Badge>
        </div>
      </div>
      {accessUser.jobTitle && (
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-foreground/60">{accessUser.jobTitle}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => onEdit(accessUser)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button
          type="button"
          variant={isActive ? "ghost" : "outline"}
          size="sm"
          className={
            isActive
              ? "flex-1 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              : "flex-1 gap-1.5 text-success hover:bg-success/10 hover:text-success"
          }
          disabled={isActive && isCurrentUser}
          title={isActive && isCurrentUser ? "Sua própria conta não pode ser desativada." : undefined}
          onClick={() => onToggleActive(accessUser)}
        >
          {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
          {isActive ? "Desativar" : "Reativar"}
        </Button>
      </div>
    </li>
  );
}
