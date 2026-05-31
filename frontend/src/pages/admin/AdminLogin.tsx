import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Clock3, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { HeroBackButton } from "@/components/layout/HeroBackButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { registerAccessAccount } from "@/features/auth/api";
import { useAuth } from "@/features/auth/auth-context";
import { readAndClearAuthNotice } from "@/features/auth/storage";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage, getApiRetryAfterSeconds } from "@/lib/api";

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type LoginFeedback =
  | {
      kind: "blocked";
      message: string;
      seconds: number;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "success";
      message: string;
    };

export default function AdminLogin() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (searchParams.get("tab") === "register" ? "register" : "login"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState<LoginFeedback | null>(null);
  const [sessionNotice] = useState(() => readAndClearAuthNotice());
  const [blockedUntilMs, setBlockedUntilMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerJobTitle, setRegisterJobTitle] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

  const blockedSeconds = useMemo(() => {
    if (!blockedUntilMs) return 0;
    return Math.max(0, Math.ceil((blockedUntilMs - nowMs) / 1000));
  }, [blockedUntilMs, nowMs]);

  useEffect(() => {
    if (!blockedUntilMs) return;

    const interval = window.setInterval(() => {
      const nextNowMs = Date.now();
      setNowMs(nextNowMs);

      if (blockedUntilMs <= nextNowMs) {
        setBlockedUntilMs(null);
        setLoginFeedback(null);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [blockedUntilMs]);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  const isLoginBlocked = blockedSeconds > 0;
  const loginButtonLabel = isSubmittingLogin
    ? "Entrando..."
    : isLoginBlocked
      ? `Tente novamente em ${formatCountdown(blockedSeconds)}`
      : "Entrar";

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoginBlocked) return;

    setIsSubmittingLogin(true);
    setLoginFeedback(null);

    try {
      await login({ email, password });
      toast({ title: "Bem-vindo(a) ao painel" });
      navigate(searchParams.get("from") || "/admin");
    } catch (error) {
      const retryAfterSeconds = getApiRetryAfterSeconds(error);

      if (retryAfterSeconds) {
        setNowMs(Date.now());
        setBlockedUntilMs(Date.now() + retryAfterSeconds * 1000);
        setLoginFeedback({
          kind: "blocked",
          message: "Muitas tentativas de login. Tente novamente mais tarde.",
          seconds: retryAfterSeconds,
        });
      } else {
        setLoginFeedback({
          kind: "error",
          message: getApiErrorMessage(error),
        });
      }
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const submitRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmittingRegister(true);

    try {
      const response = await registerAccessAccount({
        name: registerName,
        email: registerEmail,
        jobTitle: registerJobTitle,
        password: registerPassword,
      });

      toast({
        title: "Conta criada",
        description: response.message,
      });

      setEmail(response.user.email);
      setPassword("");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterJobTitle("");
      setRegisterPassword("");
      setLoginFeedback({
        kind: "success",
        message: "Cadastro concluído. Entre agora com o e-mail institucional e a senha que você definiu.",
      });
      setTab("login");
    } catch (error) {
      toast({
        title: "Não foi possível criar a conta",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  return (
    <AppShell hideBottomNav>
      <section className="px-4 pb-6 pt-4 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-card">
          <div className="bg-brand px-4 py-5 text-primary-foreground md:px-8 md:py-7">
            <HeroBackButton />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold md:text-[2rem]">Painel administrativo</h1>
            <p className="mt-2 text-sm opacity-95">Acesso restrito a administradores e coordenadores.</p>
          </div>

          <div className="p-4 md:p-8">
            {isLoading ? (
              <StatePanel>Validando sua sessão atual...</StatePanel>
            ) : (
              <div className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm md:p-5">
                <Tabs value={tab} onValueChange={setTab} className="space-y-5">
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-muted/70 p-1">
                    <TabsTrigger
                      value="login"
                      className="gap-2 rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <LogIn className="h-4 w-4" />
                      Entrar
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="gap-2 rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Cadastrar
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-0">
                    <form onSubmit={submitLogin} className="space-y-4">
                      {sessionNotice && (
                        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Sessão encerrada</AlertTitle>
                          <AlertDescription>{sessionNotice}</AlertDescription>
                        </Alert>
                      )}

                      {loginFeedback?.kind === "blocked" && (
                        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                          <Clock3 className="h-4 w-4" />
                          <AlertTitle>Login temporariamente bloqueado</AlertTitle>
                          <AlertDescription>{loginFeedback.message}</AlertDescription>
                        </Alert>
                      )}

                      {loginFeedback?.kind === "error" && (
                        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Falha no login</AlertTitle>
                          <AlertDescription>{loginFeedback.message}</AlertDescription>
                        </Alert>
                      )}

                      {loginFeedback?.kind === "success" && (
                        <Alert className="border-success/30 bg-success/5 text-success">
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>Cadastro concluído</AlertTitle>
                          <AlertDescription>{loginFeedback.message}</AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail institucional</Label>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          className="h-11 rounded-xl border-[#dbe4f3] bg-[#eef4ff] shadow-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                          id="password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          className="h-11 rounded-xl border-[#dbe4f3] bg-[#eef4ff] shadow-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmittingLogin || isLoginBlocked}
                        className="h-11 w-full rounded-xl gap-2 bg-brand text-primary-foreground hover:opacity-90"
                      >
                        <LogIn className="h-4 w-4" />
                        {loginButtonLabel}
                      </Button>

                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-0">
                    <form onSubmit={submitRegister} className="space-y-4">
                      <Alert className="border-brand/15 bg-brand/5">
                        <ShieldCheck className="h-4 w-4 text-brand" />
                        <AlertTitle>Cadastro</AlertTitle>
                        <AlertDescription>
                          O cadastro direto cria uma conta de coordenador. Perfis administrativos continuam sendo
                          criados internamente.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2">
                        <Label htmlFor="register-name">Nome completo</Label>
                        <Input
                          id="register-name"
                          autoComplete="name"
                          value={registerName}
                          onChange={(event) => setRegisterName(event.target.value)}
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
                          value={registerEmail}
                          onChange={(event) => setRegisterEmail(event.target.value)}
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
                          value={registerJobTitle}
                          onChange={(event) => setRegisterJobTitle(event.target.value)}
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
                          value={registerPassword}
                          onChange={(event) => setRegisterPassword(event.target.value)}
                          required
                          className="h-11 rounded-xl border-[#dbe4f3] bg-[#eef4ff] shadow-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmittingRegister}
                        className="h-11 w-full rounded-xl gap-2 bg-brand text-primary-foreground hover:opacity-90"
                      >
                        <UserPlus className="h-4 w-4" />
                        {isSubmittingRegister ? "Criando conta..." : "Criar conta"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
