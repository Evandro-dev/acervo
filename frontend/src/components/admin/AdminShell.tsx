import { ReactNode } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FileCheck2, DownloadCloud, BookOpen, UsersRound, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { HeroBackButton } from "@/components/layout/HeroBackButton";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuth } from "@/features/auth/auth-context";
import { getBrandedNavigationItemStateClassName } from "@/lib/branded-navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/publicacoes", label: "Publicações", icon: FileCheck2 },
  { to: "/admin/importar", label: "Importar", icon: DownloadCloud },
  { to: "/admin/eventos", label: "Eventos", icon: BookOpen },
  { to: "/admin/relatorios", label: "Relatórios", icon: FileSpreadsheet },
  { to: "/admin/usuarios", label: "Usuários", icon: UsersRound, adminOnly: true },
];

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <AppShell hideBottomNav>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-5 pt-3 md:pb-7 md:pt-6">
            <div className="mb-2 flex items-center gap-2">
              <HeroBackButton className="mb-0" />
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Admin</div>
            </div>
            <h1 className="text-lg font-bold md:text-2xl">{title}</h1>
          </SiteContainer>
        </section>
        <section className="py-4 md:py-6">
          <SiteContainer>
            <StatePanel>Validando sua sessão administrativa...</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  if (!isAuthenticated) return <Navigate to={`/admin/login?from=${pathname}`} replace />;
  if (user?.role !== "ADMIN" && user?.role !== "COORDENADOR") return <Navigate to="/" replace />;

  return (
    <AppShell hideBottomNav>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3 md:pb-7 md:pt-6">
          <div className="mb-2 flex items-center gap-2">
            <HeroBackButton className="mb-0" />
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Admin</div>
          </div>
          <h1 className="text-lg font-bold md:text-2xl">{title}</h1>
        </SiteContainer>
      </section>

      <nav className="sticky top-14.25 z-20 border-b bg-background">
        <SiteContainer>
          <ul className="flex gap-1 overflow-x-auto py-1.5">
            {tabs.filter((tab) => !tab.adminOnly || user?.role === "ADMIN").map((t) => (
              <li key={t.to} className="shrink-0">
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium md:text-sm",
                      getBrandedNavigationItemStateClassName(isActive),
                    )
                  }
                >
                  <t.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </SiteContainer>
      </nav>

      <section className="py-4 md:py-6">
        <SiteContainer>{children}</SiteContainer>
      </section>
    </AppShell>
  );
}
