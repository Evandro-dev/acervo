import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { accessUserRoleOptions } from "@/lib/access-user-role-options";
import type { UpdateAccessAccountPayload, UserAccount, UserRole } from "@/types/acervo";

type AccessUserEditDialogProps = {
  accessUser: UserAccount | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: UpdateAccessAccountPayload) => Promise<void>;
};

export function AccessUserEditDialog({ accessUser, isPending, onOpenChange, onSubmit }: AccessUserEditDialogProps) {
  return (
    <Dialog open={Boolean(accessUser)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar conta de acesso</DialogTitle>
          <DialogDescription>
            Alterações de e-mail, senha ou perfil encerram as sessões atuais desta conta.
          </DialogDescription>
        </DialogHeader>
        {accessUser ? (
          <AccessUserEditForm key={accessUser.id} accessUser={accessUser} isPending={isPending} onSubmit={onSubmit} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AccessUserEditForm({
  accessUser,
  isPending,
  onSubmit,
}: {
  accessUser: UserAccount;
  isPending: boolean;
  onSubmit: (payload: UpdateAccessAccountPayload) => Promise<void>;
}) {
  const [name, setName] = useState(accessUser.name);
  const [email, setEmail] = useState(accessUser.email);
  const [jobTitle, setJobTitle] = useState(accessUser.jobTitle ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(accessUser.role);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    await onSubmit({
      name,
      email,
      jobTitle: jobTitle.trim() || null,
      role,
      ...(password ? { password } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-access-user-name">Nome completo</Label>
        <Input
          id="edit-access-user-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-access-user-email">E-mail de acesso</Label>
        <Input
          id="edit-access-user-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-access-user-job-title">Cargo na instituição</Label>
        <Input
          id="edit-access-user-job-title"
          autoComplete="organization-title"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
        />
      </div>
      <SelectField
        id="edit-access-user-role"
        label="Perfil de acesso"
        value={role}
        options={accessUserRoleOptions}
        onValueChange={(value) => setRole(value as UserRole)}
      />
      <div className="space-y-2">
        <Label htmlFor="edit-access-user-password">Nova senha opcional</Label>
        <Input
          id="edit-access-user-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          Deixe em branco para manter a senha atual. Uma nova senha deve conter ao menos 8 caracteres, uma letra e um número.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isPending} className="gap-2 bg-brand">
          <Save className="h-4 w-4" />
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}
