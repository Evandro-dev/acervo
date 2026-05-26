import { Link } from "react-router-dom";
import { BookMarked, Building2, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { Card } from "@/components/ui/card";

export default function Sobre() {
  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-6 pt-4 md:pb-8 md:pt-6">
          <h1 className="text-xl font-bold md:text-2xl">Sobre o Acervo</h1>
          <p className="mt-1 w-full text-sm leading-relaxed opacity-90 md:text-base">
            Plataforma institucional de anais acadêmicos para consulta, descoberta e curadoria contínua da produção
            científica, com foco em organização, acesso e disseminação do conhecimento.
          </p>
        </SiteContainer>
      </section>

      <section className="py-5 md:py-7">
        <SiteContainer className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
          <Item icon={BookMarked} title="O que é">
            Plataforma centralizada para organizar, padronizar e disponibilizar anais acadêmicos, sem dependência de
            ferramentas externas de eventos.
          </Item>
          <Item icon={Building2} title="Instituição">
            Universidade Una - Pouso Alegre, Minas Gerais
          </Item>
          <Item icon={Mail} title="Contato">
            <a className="text-primary underline" href="mailto:contato@acervo.edu">
              contato@acervo.edu
            </a>
          </Item>
        </SiteContainer>
      </section>

      <section className="pb-6 pt-2 text-center">
        <SiteContainer>
          <Link
            to="/admin/login"
            className="text-[11px] text-muted-foreground/70 underline-offset-4 hover:text-muted-foreground hover:underline"
          >
            Área restrita
          </Link>
        </SiteContainer>
      </section>
    </AppShell>
  );
}

function Item({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex gap-3 border-border/60 p-3 shadow-card">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary-dark">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold">{title}</h3>
        <div className="mt-0.5 text-xs text-foreground/80">{children}</div>
      </div>
    </Card>
  );
}
