import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-8 text-center shadow-elevated">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-primary-foreground">
          <span className="text-2xl font-black">404</span>
        </div>
        <h1 className="text-xl font-bold">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O conteúdo que você buscou não está no Acervo.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Home className="h-4 w-4" /> Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
