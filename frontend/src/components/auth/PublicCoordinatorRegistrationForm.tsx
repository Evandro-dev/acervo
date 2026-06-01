import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAccessAccount } from "@/features/auth/api";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";

export function PublicCoordinatorRegistrationForm({
  onCompleted,
}: {
  onCompleted: (email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await registerAccessAccount({ name, email, jobTitle, password });

      toast({
        title: "Conta criada",
        description: response.message,
      });

      setName("");
      setEmail("");
      setJobTitle("");
      setPassword("");
      onCompleted(response.user.email);
    } catch (error) {
      toast({
        title: "Não foi possível criar a conta",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Alert className="border-brand/15 bg-brand/5">
        <ShieldCheck className="h-4 w-4 text-brand" />
        <AlertTitle>Cadastro</AlertTitle>
        <AlertDescription>
          O cadastro direto cria uma conta de coordenador. Perfis administrativos continuam sendo criados
          internamente.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="register-name">Nome completo</Label>
        <Input
          id="register-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="h-11 rounded-xl border-[#dbe4f3] shadow-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">E-mail institucional</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="h-11 rounded-xl border-[#dbe4f3] bg-[#eef4ff] shadow-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-job-title">Cargo na instituição</Label>
        <Input
          id="register-job-title"
          autoComplete="organization-title"
          placeholder="Ex.: Coordenador(a) de Pesquisa"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          required
          className="h-11 rounded-xl border-[#dbe4f3] shadow-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">Senha</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="h-11 rounded-xl border-[#dbe4f3] bg-[#eef4ff] shadow-none"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full gap-2 rounded-xl bg-brand text-primary-foreground hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" />
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
