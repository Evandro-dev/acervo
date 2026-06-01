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
import type { UserAccount } from "@/types/acervo";

type AccessUserStatusDialogProps = {
  accessUser: UserAccount | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function AccessUserStatusDialog({
  accessUser,
  isPending,
  onOpenChange,
  onConfirm,
}: AccessUserStatusDialogProps) {
  const isActive = accessUser?.isActive !== false;

  return (
    <AlertDialog open={Boolean(accessUser)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Desativar esta conta?" : "Reativar esta conta?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `"${accessUser?.name}" perderá o acesso ao painel e terá suas sessões encerradas. A conta e o histórico serão preservados.`
              : `"${accessUser?.name}" poderá entrar novamente no painel com suas credenciais atuais.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            disabled={isPending}
            className={
              isActive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-success text-success-foreground hover:bg-success/90"
            }
          >
            {isPending ? "Salvando..." : isActive ? "Desativar acesso" : "Reativar acesso"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
