import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AccessUserCard } from "@/components/admin/access-users/AccessUserCard";
import { AccessUserEditDialog } from "@/components/admin/access-users/AccessUserEditDialog";
import { AccessUserStatusDialog } from "@/components/admin/access-users/AccessUserStatusDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuth } from "@/features/auth/auth-context";
import {
  useAccessUsersQuery,
  useCreateAccessUserMutation,
  useSetAccessUserActiveMutation,
  useUpdateAccessUserMutation,
} from "@/features/users/hooks";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import type { UpdateAccessAccountPayload, UserAccount, UserRole } from "@/types/acervo";

const initialRole: UserRole = "COORDENADOR";

export default function AdminUsuarios() {
  const { isLoading: isLoadingAuth, user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const usersQuery = useAccessUsersQuery(isAdmin);
  const createUserMutation = useCreateAccessUserMutation();
  const updateUserMutation = useUpdateAccessUserMutation();
  const setUserActiveMutation = useSetAccessUserActiveMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [changingStatusUser, setChangingStatusUser] = useState<UserAccount | null>(null);

  if (!isLoadingAuth && user && !isAdmin) return <Navigate to="/admin" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const createdUser = await createUserMutation.mutateAsync({
        name,
        email,
        password,
        role,
        jobTitle: jobTitle.trim() || undefined,
      });

      setName("");
      setEmail("");
      setJobTitle("");
      setPassword("");
      setRole(initialRole);
      toast({
        title: "Usuário criado",
        description: `${createdUser.name} já pode acessar o painel.`,
      });
    } catch (error) {
      toast({
        title: "Não foi possível criar o usuário",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const updateUser = async (payload: UpdateAccessAccountPayload) => {
    if (!editingUser) return;

    try {
      const updatedUser = await updateUserMutation.mutateAsync({ userId: editingUser.id, payload });
      setEditingUser(null);
      toast({
        title: "Conta atualizada",
        description: `${updatedUser.name} teve os dados de acesso atualizados.`,
      });
    } catch (error) {
      toast({
        title: "Não foi possível atualizar a conta",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const toggleUserActive = async () => {
    if (!changingStatusUser) return;
    const shouldActivate = changingStatusUser.isActive === false;

    try {
      const updatedUser = await setUserActiveMutation.mutateAsync({
        userId: changingStatusUser.id,
        isActive: shouldActivate,
      });
      setChangingStatusUser(null);
      toast({
        title: shouldActivate ? "Conta reativada" : "Conta desativada",
        description: shouldActivate
          ? `${updatedUser.name} já pode acessar o painel novamente.`
          : `${updatedUser.name} não pode mais acessar o painel.`,
      });
    } catch (error) {
      toast({
        title: shouldActivate ? "Não foi possível reativar a conta" : "Não foi possível desativar a conta",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <AdminShell title="Usuários de acesso">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span
                aria-hidden="true"
                data-testid="create-access-user-icon"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary-dark"
              >
                <UserPlus className="h-5 w-5" />
              </span>
              Criar usuário
            </CardTitle>
            <CardDescription>
              Somente administradores podem liberar novas contas para o painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Alert className="border-brand/15 bg-brand/5">
                <ShieldCheck className="h-4 w-4 text-brand" />
                <AlertTitle>Acesso controlado</AlertTitle>
                <AlertDescription>
                  Entregue a senha inicial diretamente ao usuário e oriente o uso individual da conta.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="access-user-name">Nome completo</Label>
                <Input
                  id="access-user-name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-user-email">E-mail de acesso</Label>
                <Input
                  id="access-user-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-user-job-title">Cargo na instituição</Label>
                <Input
                  id="access-user-job-title"
                  autoComplete="organization-title"
                  placeholder="Ex.: Coordenador(a) de Pesquisa"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="access-user-role">Perfil de acesso</Label>
                  <select
                    id="access-user-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="COORDENADOR">Coordenador</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="access-user-password">Senha inicial</Label>
                  <Input
                    id="access-user-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                A senha deve ter ao menos 8 caracteres, incluindo uma letra e um número.
              </p>

              <Button type="submit" disabled={createUserMutation.isPending} className="w-full gap-2 bg-brand">
                <UserPlus className="h-4 w-4" />
                {createUserMutation.isPending ? "Criando usuário..." : "Criar usuário"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span
                aria-hidden="true"
                data-testid="access-users-list-icon"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary-dark"
              >
                <UsersRound className="h-5 w-5" />
              </span>
              Contas liberadas
            </CardTitle>
            <CardDescription>Usuários que podem entrar na área administrativa.</CardDescription>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <StatePanel>Carregando usuários...</StatePanel>
            ) : usersQuery.isError ? (
              <StatePanel>Não foi possível carregar os usuários.</StatePanel>
            ) : usersQuery.data?.length ? (
              <ul className="space-y-3">
                {usersQuery.data.map((accessUser) => (
                  <AccessUserCard
                    key={accessUser.id}
                    accessUser={accessUser}
                    isCurrentUser={accessUser.id === user?.id}
                    onEdit={setEditingUser}
                    onToggleActive={setChangingStatusUser}
                  />
                ))}
              </ul>
            ) : (
              <StatePanel>Nenhuma conta de acesso cadastrada.</StatePanel>
            )}
          </CardContent>
        </Card>
      </div>
      <AccessUserEditDialog
        accessUser={editingUser}
        isPending={updateUserMutation.isPending}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSubmit={updateUser}
      />
      <AccessUserStatusDialog
        accessUser={changingStatusUser}
        isPending={setUserActiveMutation.isPending}
        onOpenChange={(open) => !open && setChangingStatusUser(null)}
        onConfirm={toggleUserActive}
      />
    </AdminShell>
  );
}
