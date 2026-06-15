import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AccessPill } from "./AccessPill";
import { SiteContainer } from "./SiteContainer";
import { ProtectedImage } from "@/components/ui/protected-image";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  showBack?: boolean;
  showSearch?: boolean;
}

const desktopNav = [
  { to: "/", label: "Início", end: true },
  { to: "/eventos", label: "Eventos" },
  { to: "/publicacoes", label: "Publicações" },
  { to: "/autores", label: "Autores" },
  { to: "/areas", label: "Áreas" },
  { to: "/sobre", label: "Sobre" },
];

export function MobileHeader({ showBack }: MobileHeaderProps) {
  const navigate = useNavigate();
  const { logout, isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();

  const isPrivileged =
    user?.role === "ADMIN" || user?.role === "COORDENADOR";

  return (
    <header
      className="sticky top-0 z-30 text-primary-foreground"
      style={{
        background: "linear-gradient(90deg, #C00511 0%, #5A0208 100%)",
      }}
    >
      <SiteContainer className="relative flex items-center justify-between py-3">

        {/* ESQUERDA */}
        <div className="z-10 flex items-center gap-3 md:gap-4">

          {/* BOTÃO VOLTAR MOBILE */}
          {showBack && (
            <button
              type="button"
              aria-label="Voltar para a página anterior"
              onClick={() => navigate(-1)}
              className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* LOGO UNA */}
          <a
            href="https://www.una.br/unidades/pouso-alegre/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Acessar site da UNA Pouso Alegre"
            className="flex h-6 w-13 items-center overflow-hidden md:h-7 md:w-15 lg:h-7 lg:w-16"
          >
            <ProtectedImage
              src="/logo_una.svg"
              alt="Una"
              className="h-full w-full object-contain object-left"
            />
          </a>

          <div aria-hidden="true" className="hidden h-8 w-px bg-white/25 lg:block" />

          <Link to="/" className="hidden items-center lg:flex" aria-label="Ir para o início do Acervo">
            <span className="flex h-8 w-22 items-center overflow-hidden xl:w-24">
              <ProtectedImage
                src="/logo_acervo.svg"
                alt="Acervo"
                className="h-full w-full object-contain object-left"
              />
            </span>
          </Link>
        </div>

        {/* LOGO ACERVO CENTRALIZADA MOBILE */}
        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 lg:hidden"
          aria-label="Ir para o início do Acervo"
        >
          <span className="flex h-7 w-19 items-center overflow-hidden md:h-8 md:w-22">
            <ProtectedImage
              src="/logo_acervo.svg"
              alt="Acervo"
              className="h-full w-full object-contain"
            />
          </span>
        </Link>

        {/* NAVEGAÇÃO DESKTOP */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex">
          <nav className="pointer-events-auto">
            <ul className="flex items-center gap-2">
              {desktopNav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-4 py-2 text-sm font-semibold transition-all",
                        isActive ||
                          (item.to !== "/" &&
                            pathname.startsWith(item.to))
                          ? "bg-white/20 text-white"
                          : "opacity-80 hover:bg-white/10 hover:opacity-100"
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* LOGIN / ADMIN */}
        <div className="z-10 flex items-center gap-3">
          <AccessPill
            isAuthenticated={isAuthenticated}
            isPrivileged={isPrivileged}
            onLogout={() => {
              logout();
              navigate("/");
            }}
          />
        </div>
      </SiteContainer>
    </header>
  );
}
