import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

const ISO_DATE_FORMAT = "yyyy-MM-dd";

export function formatDateRangeLabel(range?: DateRange) {
  const from = range?.from;
  if (!from) return "";

  const to = range.to ?? from;
  const sameDay =
    from.getDate() === to.getDate() &&
    from.getMonth() === to.getMonth() &&
    from.getFullYear() === to.getFullYear();
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const sameYear = from.getFullYear() === to.getFullYear();

  if (sameDay) {
    return format(from, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  if (sameMonth) {
    return `${format(from, "d", { locale: ptBR })} a ${format(to, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  }

  if (sameYear) {
    return `${format(from, "d 'de' MMMM", { locale: ptBR })} a ${format(to, "d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    })}`;
  }

  return `${format(from, "d 'de' MMMM 'de' yyyy", { locale: ptBR })} a ${format(
    to,
    "d 'de' MMMM 'de' yyyy",
    { locale: ptBR },
  )}`;
}

function parseIsoDate(value?: string) {
  if (!value) return undefined;

  const date = parseISO(value);
  return isValid(date) && format(date, ISO_DATE_FORMAT) === value ? date : undefined;
}

export function dateRangeFromIsoDates(dateFrom?: string, dateTo?: string): DateRange | undefined {
  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);

  return from || to ? { from, to } : undefined;
}

export function dateRangeToIsoDates(range?: DateRange) {
  return {
    dateFrom: range?.from ? format(range.from, ISO_DATE_FORMAT) : undefined,
    dateTo: range?.to ? format(range.to, ISO_DATE_FORMAT) : undefined,
  };
}
