import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Calendar, Mail, Phone, FileDown, ChevronRight, BookMarked, ExternalLink } from "lucide-react";
import { PublicationEngagementIndicators } from "@/components/publications/PublicationMetaRow";
import { AppShell } from "@/components/layout/AppShell";
import { HeroBackButton } from "@/components/layout/HeroBackButton";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StatePanel } from "@/components/ui/state-panel";
import { useEventQuery, useTrackEventViewMutation } from "@/features/acervo/hooks";
import { toast } from "@/hooks/use-toast";
import { getApiResourceUrl } from "@/lib/api";
import { reserveViewTracking, rollbackViewTracking } from "@/lib/engagement";
import { getBrandedNavigationItemStateClassName } from "@/lib/branded-navigation";
import { getEventRuleDocumentLabel } from "@/lib/event-rule-documents";
import { isUsableResourceUrl } from "@/lib/file-links";
import { cn } from "@/lib/utils";
import type { EventCommitteeMember, EventPreviousEdition } from "@/types/acervo";

const committeeGroups = [
  { key: "Organizadora", title: "Comissão Organizadora" },
  { key: "Científica", title: "Comissão Científica" },
] as const;

function normalizeCommitteeType(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (normalized === "CIENTIFICA") return "Científica";
  if (normalized === "ORGANIZADORA") return "Organizadora";
  return "Outra";
}

function groupCommitteeMembers(committee: EventCommitteeMember[]) {
  const grouped = committeeGroups
    .map((group) => ({
      ...group,
      members: committee.filter((member) => normalizeCommitteeType(member.role) === group.key),
    }))
    .filter((group) => group.members.length > 0);

  const otherMembers = committee.filter((member) => normalizeCommitteeType(member.role) === "Outra");
  return otherMembers.length ? [...grouped, { key: "Outra", title: "Outras funções", members: otherMembers }] : grouped;
}

function getPreviousEditionInternalHref(edition: EventPreviousEdition) {
  const lookup = edition.eventSlug || edition.eventId;
  return lookup ? `/eventos/${lookup}` : undefined;
}

function EditionCardContent({
  edition,
  isExternal,
}: {
  edition: EventPreviousEdition;
  isExternal?: boolean;
}) {
  const Icon = isExternal ? ExternalLink : ChevronRight;

  return (
    <Card className="flex items-center justify-between gap-3 border-border/60 p-3 shadow-card transition hover:border-primary/40 hover:bg-brand-soft/40">
      <div className="min-w-0">
        <div className="text-sm font-bold">{edition.label}</div>
        <div className="text-xs text-muted-foreground">{edition.year}</div>
      </div>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Card>
  );
}

export default function EventoDetalhe() {
  const { id } = useParams();
  const { data: event, isLoading, isError } = useEventQuery(id, "published", {
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const trackEventViewMutation = useTrackEventViewMutation();
  const [activeTab, setActiveTab] = useState("apresentacao");

  useEffect(() => {
    if (!event?.id) return;
    if (!reserveViewTracking("event", event.id)) return;

    trackEventViewMutation.mutate(event.id, {
      onError: () => rollbackViewTracking("event", event.id),
    });
  }, [event?.id, trackEventViewMutation]);

  if (isLoading) {
    return (
      <AppShell>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-5 pt-3">
            <HeroBackButton />
            <h1 className="text-xl font-bold leading-tight">Carregando evento...</h1>
          </SiteContainer>
        </section>
        <section className="py-4">
          <SiteContainer>
            <StatePanel>Buscando os detalhes do evento.</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  if (isError || !event) {
    return (
      <AppShell>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-5 pt-3">
            <HeroBackButton />
            <h1 className="text-xl font-bold leading-tight">Evento</h1>
          </SiteContainer>
        </section>
        <section className="py-4">
          <SiteContainer>
            <StatePanel>Não foi possível carregar este evento.</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  const approved = event.articles.filter((article) => article.status === "published");
  const groupedCommittee = groupCommitteeMembers(event.committee);

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <HeroBackButton />
          <Badge className="mb-2 border-0 bg-white/20 text-primary-foreground">{event.type}</Badge>
          <h1 className="text-xl font-bold leading-tight">{event.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs opacity-90">
            <Calendar className="h-3.5 w-3.5" /> {event.date}
          </p>
          <p className="mt-2 text-[11px] opacity-80">
            {event.edition} · {event.area}
          </p>
        </SiteContainer>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-14.25 z-20 border-b bg-background">
          <SiteContainer>
            <TabsList className="h-auto w-full justify-start gap-1 rounded-none bg-transparent px-0 py-1.5">
              {[
                ["apresentacao", "Apresentação"],
                ["publicacoes", "Publicações"],
                ["sobre", "Sobre"],
              ].map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
                    getBrandedNavigationItemStateClassName(activeTab === value),
                  )}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </SiteContainer>
        </div>

        <section className="py-4">
          <SiteContainer>
            <TabsContent value="apresentacao" className="m-0">
              <SectionTitle>Apresentação do Evento</SectionTitle>
              <p className="text-sm leading-relaxed text-foreground/80">{event.presentation}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {event.themes.slice(0, 5).map((theme) => (
                  <Badge key={theme} variant="outline" className="font-normal">
                    {theme}
                  </Badge>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="publicacoes" className="m-0 space-y-3">
              <SectionTitle>{approved.length} Publicações</SectionTitle>
              {approved.length === 0 ? (
                <StatePanel>Nenhuma publicação aprovada neste evento.</StatePanel>
              ) : (
                approved.map((article) => (
                  <Card key={article.id} className="overflow-hidden border-border/60 shadow-card">
                    <div className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary-dark">
                          <BookMarked className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold leading-tight">{article.title}</h3>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {article.authors.join(" · ")} · pp. {article.pages}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                              {article.area}
                            </Badge>
                            <PublicationEngagementIndicators
                              viewCount={article.viewCount}
                              showDownloads={false}
                              className="text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/eventos/${event.slug}/artigos/${article.id}`}
                      className="flex items-center justify-between border-t border-border/60 bg-brand-soft px-4 py-2 text-xs font-semibold text-primary-dark"
                    >
                      Ver artigo <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="sobre" className="m-0">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="comissao">
                  <AccordionTrigger className="text-sm font-bold text-brand">Comissão</AccordionTrigger>
                  <AccordionContent>
                    {groupedCommittee.length === 0 ? (
                      <StatePanel>Nenhum membro de comissão cadastrado.</StatePanel>
                    ) : (
                      <div className="space-y-3">
                        {groupedCommittee.map((group) => (
                          <Card key={group.key} className="border-border/60 p-3 shadow-card">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-brand">{group.title}</h3>
                            <ul className="mt-2 divide-y text-sm">
                              {group.members.map((member) => (
                                <li key={`${group.key}-${member.name}-${member.role}`} className="py-2 first:pt-0 last:pb-0">
                                  <span className="font-medium">{member.name}</span>
                                  {group.key === "Outra" ? (
                                    <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                                      {member.role}
                                    </Badge>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </Card>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ficha">
                  <AccordionTrigger className="text-sm font-bold text-brand">Ficha Catalográfica</AccordionTrigger>
                  <AccordionContent>
                    <Card className="border-border/60 p-4 shadow-card">
                      <dl className="space-y-2 text-sm">
                        <Field label="ISBN" value={event.catalog.isbn ?? "—"} />
                        <Field label="Editora" value={event.catalog.publisher ?? "—"} />
                        <Field label="Endereço" value={event.catalog.address ?? "—"} />
                        <Field label="Edição" value={event.edition} />
                      </dl>
                    </Card>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="temas">
                  <AccordionTrigger className="text-sm font-bold text-brand">Área Temática</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2">
                      {event.themes.map((theme) => (
                        <div
                          key={theme}
                          className="w-full rounded-lg border border-border/60 bg-brand-soft p-3 text-sm font-medium text-primary-dark wrap-break-word whitespace-normal"
                        >
                          {theme}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="normas">
                  <AccordionTrigger className="text-sm font-bold text-brand">Normas</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {event.rules.map((rule, index) => (
                      <Card key={`${rule.title}-${index}`} className="flex items-center justify-between border-border/60 p-3 shadow-card">
                        <span className="text-sm font-medium">{rule.title}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            if (isUsableResourceUrl(rule.file)) {
                              window.open(getApiResourceUrl(rule.file), "_blank", "noopener,noreferrer");
                              return;
                            }

                            toast({ title: "Arquivo indisponível", description: "A norma ainda não foi vinculada." });
                          }}
                        >
                          <FileDown className="h-4 w-4" /> {getEventRuleDocumentLabel(rule.file)}
                        </Button>
                      </Card>
                    ))}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="edicoes">
                  <AccordionTrigger className="text-sm font-bold text-brand">Edições</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {event.previousEditions.length === 0 && (
                      <p className="text-sm text-muted-foreground">Esta é a primeira edição.</p>
                    )}
                    {event.previousEditions.map((edition) => (
                      <PreviousEditionCard key={edition.id} edition={edition} />
                    ))}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contato">
                  <AccordionTrigger className="text-sm font-bold text-brand">Contato</AccordionTrigger>
                  <AccordionContent>
                    <Card className="space-y-2 border-border/60 p-4 shadow-card">
                      <a href={`mailto:${event.contact.email}`} className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" /> {event.contact.email}
                      </a>
                      {event.contact.phone && (
                        <p className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-primary" /> {event.contact.phone}
                        </p>
                      )}
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </SiteContainer>
        </section>
      </Tabs>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-base font-bold text-brand">{children}</h2>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm">{value}</dd>
    </div>
  );
}

function PreviousEditionCard({ edition }: { edition: EventPreviousEdition }) {
  const internalHref = getPreviousEditionInternalHref(edition);

  if (internalHref) {
    return (
      <Link to={internalHref} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <EditionCardContent edition={edition} />
      </Link>
    );
  }

  if (edition.externalUrl) {
    return (
      <a
        href={edition.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <EditionCardContent edition={edition} isExternal />
      </a>
    );
  }

  return (
    <Card className="flex items-center justify-between gap-3 border-border/60 p-3 shadow-card">
      <div className="min-w-0">
        <div className="text-sm font-bold">{edition.label}</div>
        <div className="text-xs text-muted-foreground">{edition.year}</div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sem link</span>
    </Card>
  );
}
