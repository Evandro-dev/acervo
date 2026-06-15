import type { Dispatch, SetStateAction } from "react";
import { ExternalLink, FileText, Plus, Trash2, Upload } from "lucide-react";
import { DocumentFilePicker } from "@/components/admin/DocumentFilePicker";
import {
  EmptyHint,
  FormAccordionSection,
} from "@/components/admin/EventFormSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  createRuleItem,
  getRuleFileMode,
  removeItemByKey,
  replaceItemByKey,
  setRuleFileMode,
  type FormState,
} from "@/features/acervo/event-form-model";
import { toast } from "@/hooks/use-toast";
import { isStoredEventRuleFileUrl } from "@/lib/event-rule-file";
import {
  eventRuleDocumentAccept,
  isSupportedEventRuleDocument,
  removeEventRuleDocumentExtension,
} from "@/lib/event-rule-documents";
import { isUsableResourceUrl } from "@/lib/file-links";

type EventRulesSectionProps = {
  rules: FormState["rules"];
  onFormChange: Dispatch<SetStateAction<FormState>>;
};

export function EventRulesSection({
  onFormChange,
  rules,
}: EventRulesSectionProps) {
  return (
    <FormAccordionSection
      value="normas"
      title="Normas"
      description="Cadastre título e arquivo PDF, DOCX ou PPTX de cada norma publicada no evento."
    >
      {rules.length === 0 ? <EmptyHint>Nenhuma norma cadastrada.</EmptyHint> : null}

      <div className="flex flex-col gap-3">
        {rules.map((rule, index) => (
          <Card key={rule.key} className="border-border/60 p-3">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`event-rule-title-${rule.key}`}>
                    Título da norma
                  </Label>
                  <Input
                    id={`event-rule-title-${rule.key}`}
                    value={rule.title}
                    onChange={(event) =>
                      onFormChange((current) => ({
                        ...current,
                        rules: replaceItemByKey(current.rules, rule.key, {
                          title: event.target.value,
                        }),
                      }))
                    }
                    placeholder="Normas de submissão"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="w-full sm:w-10"
                    aria-label={`Remover norma ${index + 1}`}
                    title={`Remover norma ${index + 1}`}
                    onClick={() =>
                      onFormChange((current) => ({
                        ...current,
                        rules:
                          current.rules.length > 1
                            ? removeItemByKey(current.rules, rule.key)
                            : [createRuleItem()],
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs text-primary-dark">
                <FileText className="h-4 w-4" />O fluxo principal é submeter o
                arquivo no Acervo. Use link externo somente quando ele já
                estiver hospedado fora.
              </div>

              <SegmentedControl
                ariaLabel="Origem do arquivo da norma"
                className="grid-cols-2"
                value={getRuleFileMode(rule)}
                onValueChange={(mode) =>
                  onFormChange((current) => ({
                    ...current,
                    rules: replaceItemByKey(
                      current.rules,
                      rule.key,
                      setRuleFileMode(rule, mode),
                    ),
                  }))
                }
                options={[
                  {
                    value: "upload",
                    label: (
                      <>
                        <Upload className="h-4 w-4" /> Enviar arquivo
                      </>
                    ),
                  },
                  {
                    value: "external",
                    label: (
                      <>
                        <ExternalLink className="h-4 w-4" /> Usar link externo
                      </>
                    ),
                  },
                ]}
              />

              {rule.useExternalLink ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`event-rule-external-url-${rule.key}`}>
                    Link externo do arquivo
                  </Label>
                  <Input
                    id={`event-rule-external-url-${rule.key}`}
                    value={rule.fileUrl}
                    onChange={(event) =>
                      onFormChange((current) => ({
                        ...current,
                        rules: replaceItemByKey(current.rules, rule.key, {
                          fileUrl: event.target.value,
                        }),
                      }))
                    }
                    placeholder="https://..."
                  />
                  {rule.fileUrl && isUsableResourceUrl(rule.fileUrl) ? (
                    <LinkedRuleFileStatus
                      href={rule.fileUrl}
                      label="Link externo pronto para uso."
                    />
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium leading-none">
                    Arquivo da norma
                  </div>
                  <DocumentFilePicker
                    accept={eventRuleDocumentAccept}
                    title={
                      rule.fileUrl
                        ? "Selecionar novo arquivo da norma"
                        : "Selecionar arquivo da norma"
                    }
                    description="Envie um arquivo .pdf, .docx ou .pptx para publicar com o evento."
                    selectedFile={rule.pendingFile}
                    onFilesChange={(files) => {
                      const file = files[0] ?? null;
                      if (file && !isSupportedEventRuleDocument(file)) {
                        toast({
                          title: "Arquivo não suportado",
                          description: "Selecione um arquivo PDF, DOCX ou PPTX.",
                          variant: "destructive",
                        });
                        return;
                      }

                      onFormChange((current) => ({
                        ...current,
                        rules: replaceItemByKey(current.rules, rule.key, {
                          pendingFile: file,
                          title:
                            file && !rule.title.trim()
                              ? removeEventRuleDocumentExtension(file.name)
                              : rule.title,
                        }),
                      }));
                    }}
                    removeAriaLabel="Remover arquivo da norma selecionado"
                    replaceLabel="Trocar arquivo"
                    onRemove={() =>
                      onFormChange((current) => ({
                        ...current,
                        rules: replaceItemByKey(current.rules, rule.key, {
                          pendingFile: null,
                        }),
                      }))
                    }
                  />

                  {rule.fileUrl && isStoredEventRuleFileUrl(rule.fileUrl) ? (
                    <LinkedRuleFileStatus
                      href={
                        isUsableResourceUrl(rule.fileUrl)
                          ? rule.fileUrl
                          : undefined
                      }
                      label="Arquivo atual vinculado."
                    />
                  ) : null}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() =>
          onFormChange((current) => ({
            ...current,
            rules: [...current.rules, createRuleItem()],
          }))
        }
      >
        <Plus className="h-4 w-4" /> Adicionar norma
      </Button>
    </FormAccordionSection>
  );
}

function LinkedRuleFileStatus({
  href,
  label,
}: {
  href?: string;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <FileText className="h-4 w-4" />
      <span className="truncate">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-primary"
        >
          Abrir <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
