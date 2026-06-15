import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  EmptyHint,
  FormAccordionSection,
} from "@/components/admin/EventFormSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPreviousEditionItem,
  removeItemByKey,
  replaceItemByKey,
  type FormState,
  type PreviousEditionFormItem,
} from "@/features/acervo/event-form-model";
import type { EventOption } from "@/types/acervo";

type EventPreviousEditionsSectionProps = {
  eventOptions: EventOption[];
  onFormChange: Dispatch<SetStateAction<FormState>>;
  previousEditions: FormState["previousEditions"];
};

export function EventPreviousEditionsSection({
  eventOptions,
  onFormChange,
  previousEditions,
}: EventPreviousEditionsSectionProps) {
  return (
    <FormAccordionSection
      value="edicoes"
      title="Edições anteriores"
      description="Histórico exibido na seção pública do evento."
    >
      {previousEditions.length === 0 ? (
        <EmptyHint>Esta pode ser a primeira edição.</EmptyHint>
      ) : null}

      <div className="flex flex-col gap-3">
        {previousEditions.map((edition, index) => (
          <Card key={edition.key} className="border-border/60 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`event-previous-edition-label-${edition.key}`}>
                  Nome
                </Label>
                <Input
                  id={`event-previous-edition-label-${edition.key}`}
                  value={edition.label}
                  onChange={(event) =>
                    onFormChange((current) => ({
                      ...current,
                      previousEditions: replaceItemByKey(
                        current.previousEditions,
                        edition.key,
                        { label: event.target.value },
                      ),
                    }))
                  }
                  placeholder="I Congresso Multidisciplinar"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`event-previous-edition-year-${edition.key}`}>
                  Ano
                </Label>
                <Input
                  id={`event-previous-edition-year-${edition.key}`}
                  type="number"
                  value={edition.year}
                  onChange={(event) =>
                    onFormChange((current) => ({
                      ...current,
                      previousEditions: replaceItemByKey(
                        current.previousEditions,
                        edition.key,
                        { year: event.target.value },
                      ),
                    }))
                  }
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="w-full sm:w-10"
                  aria-label={`Remover edição anterior ${index + 1}`}
                  title={`Remover edição anterior ${index + 1}`}
                  onClick={() =>
                    onFormChange((current) => ({
                      ...current,
                      previousEditions: removeItemByKey(
                        current.previousEditions,
                        edition.key,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor={`event-previous-edition-link-mode-${edition.key}`}
                >
                  Destino da seta
                </Label>
                <Select
                  name={`event-previous-edition-link-mode-${edition.key}`}
                  value={edition.linkMode}
                  onValueChange={(value) =>
                    onFormChange((current) => ({
                      ...current,
                      previousEditions: replaceItemByKey(
                        current.previousEditions,
                        edition.key,
                        {
                          linkMode:
                            value as PreviousEditionFormItem["linkMode"],
                          eventId:
                            value === "internal" ? edition.eventId : "",
                          externalUrl:
                            value === "external" ? edition.externalUrl : "",
                        },
                      ),
                    }))
                  }
                >
                  <SelectTrigger
                    id={`event-previous-edition-link-mode-${edition.key}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem link</SelectItem>
                    <SelectItem value="internal">Evento no Acervo</SelectItem>
                    <SelectItem value="external">Link externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {edition.linkMode === "internal" ? (
                <InternalPreviousEditionTarget
                  edition={edition}
                  eventOptions={eventOptions}
                  onFormChange={onFormChange}
                />
              ) : null}

              {edition.linkMode === "external" ? (
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor={`event-previous-edition-external-url-${edition.key}`}
                  >
                    Link externo da edição
                  </Label>
                  <Input
                    id={`event-previous-edition-external-url-${edition.key}`}
                    value={edition.externalUrl}
                    onChange={(event) =>
                      onFormChange((current) => ({
                        ...current,
                        previousEditions: replaceItemByKey(
                          current.previousEditions,
                          edition.key,
                          { externalUrl: event.target.value },
                        ),
                      }))
                    }
                    placeholder="https://..."
                  />
                </div>
              ) : null}
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
            previousEditions: [
              ...current.previousEditions,
              createPreviousEditionItem(),
            ],
          }))
        }
      >
        <Plus className="h-4 w-4" /> Adicionar edição anterior
      </Button>
    </FormAccordionSection>
  );
}

function InternalPreviousEditionTarget({
  edition,
  eventOptions,
  onFormChange,
}: {
  edition: PreviousEditionFormItem;
  eventOptions: EventOption[];
  onFormChange: Dispatch<SetStateAction<FormState>>;
}) {
  if (!eventOptions.length) {
    return <EmptyHint>Nenhum outro evento cadastrado no Acervo.</EmptyHint>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`event-previous-edition-event-${edition.key}`}>
        Evento vinculado
      </Label>
      <Select
        name={`event-previous-edition-event-${edition.key}`}
        value={edition.eventId || undefined}
        onValueChange={(eventId) => {
          const selectedEvent = eventOptions.find(
            (event) => event.id === eventId,
          );

          onFormChange((current) => ({
            ...current,
            previousEditions: replaceItemByKey(
              current.previousEditions,
              edition.key,
              {
                eventId,
                label: edition.label || selectedEvent?.title || "",
                year:
                  edition.year ||
                  (selectedEvent ? String(selectedEvent.year) : ""),
              },
            ),
          }));
        }}
      >
        <SelectTrigger id={`event-previous-edition-event-${edition.key}`}>
          <SelectValue placeholder="Selecione o evento da edição" />
        </SelectTrigger>
        <SelectContent>
          {eventOptions.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              {event.year} · {event.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
