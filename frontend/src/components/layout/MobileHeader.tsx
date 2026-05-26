import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AccessPill } from "./AccessPill";
import { SiteContainer } from "./SiteContainer";
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
        <div className="flex items-center gap-4 md:gap-8">

          {/* BOTÃO VOLTAR MOBILE */}
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* LOGO UNA */}
          <Link to="/" className="z-10 flex items-center">
            <img
              src="/logo_una.png"
              alt="Una"
              className="h-7 w-auto md:h-9"
            />
          </Link>
        </div>

        {/* LOGO ACERVO CENTRALIZADA MOBILE */}
        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"
        >
          <div className="flex items-center gap-5">
            
            {/* DIVISOR DESKTOP */}
            <div className="hidden h-8 w-px bg-white/20 md:block" />

            <img
              src="/logo_acervo.png"
              alt="Acervo"
              className="h-8 w-auto md:h-10"
            />
          </div>
        </Link>

        {/* NAVEGAÇÃO DESKTOP */}
        <div className="hidden flex-1 justify-center lg:flex">
          <nav>
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
