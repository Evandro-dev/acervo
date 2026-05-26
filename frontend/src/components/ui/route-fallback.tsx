import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { HeroBackButton } from "@/components/layout/HeroBackButton";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { StatePanel } from "@/components/ui/state-panel";

export function RouteFallback() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <AppShell hideBottomNav={isAdminRoute}>
      {isAdminRoute && (
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-5 pt-3 md:pb-7 md:pt-6">
            <div className="mb-2 flex items-center gap-2">
              <HeroBackButton className="mb-0" />
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Admin</div>
            </div>
            <h1 className="text-lg font-bold md:text-2xl">Carregando</h1>
          </SiteContainer>
        </section>
      )}

      <section className="py-4 md:py-6">
        <SiteContainer>
          <StatePanel>{isAdminRoute ? "Carregando área administrativa..." : "Carregando página..."}</StatePanel>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
