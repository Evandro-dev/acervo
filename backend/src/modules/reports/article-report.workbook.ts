import ExcelJS from "exceljs";
import type { ArticleReportFilters } from "./article-report.filters.js";

const EMPTY_VALUE = "Não informado";

export type ArticleReportItem = {
  title: string;
  authors: string[];
  area: string;
  courses: string[];
  eventTitle: string;
  eventYear: number;
  modality?: string | null;
  status: string;
  pages?: string | null;
  pdfUrl?: string | null;
  submittedAt: Date;
  importedAt?: Date | null;
  publishedAt?: Date | null;
};

type BuildArticleReportWorkbookInput = {
  items: ArticleReportItem[];
  filters: ArticleReportFilters;
  filterLabels?: {
    event?: string;
  };
  generatedAt?: Date;
};

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "PUBLISHED":
      return "Publicado";
    case "DRAFT":
      return "Rascunho";
    case "ARCHIVED":
      return "Arquivado";
    default:
      return status;
  }
}

function filterStatusLabel(status: ArticleReportFilters["status"]) {
  return status === "all" ? "Todos" : statusLabel(status);
}

function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : EMPTY_VALUE;
}

export function sanitizeSpreadsheetText(value?: string | null) {
  const text = value?.trim() || EMPTY_VALUE;
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function summarize(items: ArticleReportItem[], getValues: (item: ArticleReportItem) => string[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const values = Array.from(new Set(getValues(item).map(sanitizeSpreadsheetText)));
    for (const value of values.length ? values : [EMPTY_VALUE]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => [name, count] as const)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function styleTable(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
}

function addSummarySheet(workbook: ExcelJS.Workbook, title: string, label: string, rows: readonly (readonly [string, number])[]) {
  const worksheet = workbook.addWorksheet(title);
  worksheet.columns = [
    { header: label, key: "name", width: 42 },
    { header: "Quantidade de trabalhos", key: "count", width: 24 },
  ];
  worksheet.addRows(rows.map(([name, count]) => ({ name, count })));
  styleTable(worksheet);
}

export async function buildArticleReportWorkbook({
  items,
  filters,
  filterLabels,
  generatedAt = new Date(),
}: BuildArticleReportWorkbookInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ACERVO UNA";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const overview = workbook.addWorksheet("Visão geral");
  overview.columns = [
    { key: "label", width: 30 },
    { key: "value", width: 52 },
  ];
  overview.addRows([
    ["Relatório de trabalhos do ACERVO UNA"],
    [],
    ["Gerado em", generatedAt.toISOString()],
    ["Total de trabalhos", items.length],
    ["Status", filterStatusLabel(filters.status)],
    ["Evento", sanitizeSpreadsheetText(filterLabels?.event || filters.eventId || "Todos")],
    ["Área", sanitizeSpreadsheetText(filters.area || "Todas")],
    ["Curso", sanitizeSpreadsheetText(filters.course || "Todos")],
    ["Submissão a partir de", filters.dateFrom || "Sem limite"],
    ["Submissão até", filters.dateTo || "Sem limite"],
    [],
    ["Publicados", items.filter((item) => item.status.toUpperCase() === "PUBLISHED").length],
    ["Rascunhos", items.filter((item) => item.status.toUpperCase() === "DRAFT").length],
    ["Arquivados", items.filter((item) => item.status.toUpperCase() === "ARCHIVED").length],
  ]);
  overview.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1F4E78" } };
  overview.mergeCells("A1:B1");
  overview.getColumn(1).font = { bold: true };

  addSummarySheet(workbook, "Resumo por área", "Área", summarize(items, (item) => [item.area]));
  addSummarySheet(workbook, "Resumo por curso", "Curso", summarize(items, (item) => item.courses));

  const details = workbook.addWorksheet("Trabalhos detalhados");
  details.columns = [
    { header: "Título", key: "title", width: 44 },
    { header: "Autores", key: "authors", width: 44 },
    { header: "Área", key: "area", width: 24 },
    { header: "Cursos", key: "courses", width: 36 },
    { header: "Evento", key: "event", width: 36 },
    { header: "Ano do evento", key: "eventYear", width: 15 },
    { header: "Modalidade", key: "modality", width: 22 },
    { header: "Status", key: "status", width: 14 },
    { header: "Páginas", key: "pages", width: 14 },
    { header: "Data de submissão", key: "submittedAt", width: 20 },
    { header: "Data de importação", key: "importedAt", width: 20 },
    { header: "Data de publicação", key: "publishedAt", width: 20 },
    { header: "Link do PDF", key: "pdfUrl", width: 52 },
  ];
  details.addRows(
    items.map((item) => ({
      title: sanitizeSpreadsheetText(item.title),
      authors: sanitizeSpreadsheetText(item.authors.join(", ")),
      area: sanitizeSpreadsheetText(item.area),
      courses: sanitizeSpreadsheetText(item.courses.join(", ")),
      event: sanitizeSpreadsheetText(item.eventTitle),
      eventYear: item.eventYear,
      modality: sanitizeSpreadsheetText(item.modality),
      status: statusLabel(item.status),
      pages: sanitizeSpreadsheetText(item.pages),
      submittedAt: formatDate(item.submittedAt),
      importedAt: formatDate(item.importedAt),
      publishedAt: formatDate(item.publishedAt),
      pdfUrl: sanitizeSpreadsheetText(item.pdfUrl),
    })),
  );
  styleTable(details);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
