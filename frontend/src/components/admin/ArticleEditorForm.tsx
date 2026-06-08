import { AreaCombobox } from "@/components/ui/area-combobox";
import { CourseMultiCombobox } from "@/components/ui/course-multi-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ARTICLE_MODALITIES, type ArticleFormValue, type ArticleModality } from "@/lib/article-form";
import { cn } from "@/lib/utils";

type ArticleEditorFormProps = {
  value: ArticleFormValue;
  onChange: (patch: Partial<ArticleFormValue>) => void;
  areaOptions: string[];
  courseOptions: string[];
  idPrefix: string;
  disabled?: boolean;
  showPages?: boolean;
  abstractRows?: number;
  className?: string;
};

export function ArticleEditorForm({
  value,
  onChange,
  areaOptions,
  courseOptions,
  idPrefix,
  disabled = false,
  showPages = true,
  abstractRows = 6,
  className,
}: ArticleEditorFormProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label htmlFor={`${idPrefix}-title`} className="text-xs">
          Título
        </Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-authors`} className="text-xs">
          Autores (separados por vírgula)
        </Label>
        <Input
          id={`${idPrefix}-authors`}
          value={value.authors}
          onChange={(event) => onChange({ authors: event.target.value })}
          placeholder="Ex.: Ana Silva, Carlos Lima"
          disabled={disabled}
        />
      </div>

      <div className={cn("grid gap-2", showPages ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <div>
          <Label htmlFor={`${idPrefix}-area`} className="text-xs">
            Área
          </Label>
          <AreaCombobox
            id={`${idPrefix}-area`}
            value={value.area}
            options={areaOptions}
            onValueChange={(area) => onChange({ area })}
            placeholder="Digite ou escolha uma área"
            disabled={disabled}
          />
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-modality`} className="text-xs">
            Modalidade
          </Label>
          <Select
            name={`${idPrefix}-modality`}
            value={value.modalidade}
            onValueChange={(modalidade) => onChange({ modalidade: modalidade as ArticleModality })}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-modality`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARTICLE_MODALITIES.map((modalidade) => (
                <SelectItem key={modalidade} value={modalidade}>
                  {modalidade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showPages ? (
          <div>
            <Label htmlFor={`${idPrefix}-pages`} className="text-xs">
              Páginas
            </Label>
            <Input
              id={`${idPrefix}-pages`}
              value={value.pages}
              onChange={(event) => onChange({ pages: event.target.value })}
              placeholder="Ex.: 15-28"
              disabled={disabled}
            />
          </div>
        ) : null}
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-courses`} className="text-xs">
          Cursos relacionados (separados por vírgula)
        </Label>
        <CourseMultiCombobox
          id={`${idPrefix}-courses`}
          value={value.courses}
          options={courseOptions}
          onValueChange={(courses) => onChange({ courses })}
          placeholder="Ex.: Enfermagem, Biomedicina"
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-abstract`} className="text-xs">
          Resumo
        </Label>
        <Textarea
          id={`${idPrefix}-abstract`}
          rows={abstractRows}
          value={value.abstract}
          onChange={(event) => onChange({ abstract: event.target.value })}
          placeholder="Preenchido automaticamente quando possível"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
