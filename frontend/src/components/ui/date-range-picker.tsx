import { useId } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateRangeLabel } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  id?: string;
  label: string;
  value?: DateRange;
  onChange: (value: DateRange | undefined) => void;
  placeholder: string;
  fallbackLabel?: string;
  clearLabel?: string;
  className?: string;
};

export function DateRangePicker({
  id,
  label,
  value,
  onChange,
  placeholder,
  fallbackLabel,
  clearLabel = "Limpar período",
  className,
}: DateRangePickerProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const selectedLabel = formatDateRangeLabel(value);
  const triggerLabel = selectedLabel || fallbackLabel?.trim() || placeholder;
  const hasValue = Boolean(value?.from || value?.to || fallbackLabel?.trim());

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={triggerId}>{label}</Label>
        {hasValue ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent"
            onClick={() => onChange(undefined)}
          >
            {clearLabel}
          </Button>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            aria-label={`${label}: ${triggerLabel}`}
            className={cn(
              "h-auto min-h-12 w-full justify-start whitespace-normal rounded-xl border-border/60 px-3 py-3 text-left font-normal",
              !hasValue && "text-muted-foreground",
            )}
          >
            <CalendarDays data-icon="inline-start" />
            {triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] overflow-x-auto p-0">
          <Calendar
            mode="range"
            locale={ptBR}
            selected={value}
            onSelect={onChange}
            defaultMonth={value?.from ?? value?.to}
            numberOfMonths={1}
            resetOnSelect
            autoFocus
            role="application"
            aria-label={`Calendário para ${label.toLowerCase()}`}
            footer={selectedLabel || "Selecione a data inicial e a data final."}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
