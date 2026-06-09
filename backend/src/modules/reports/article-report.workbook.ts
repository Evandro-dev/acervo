import ExcelJS from "exceljs";
import type { ArticleReportFilters } from "./article-report.filters.js";

const EMPTY_VALUE = "Não informado";
const REPORT_RED = "FFC00000";
const REPORT_WHITE = "FFFFFFFF";
const REPORT_ZEBRA_GRAY = "FFD9D9D9";
const REPORT_BORDER_GRAY = "FFBFBFBF";
const REPORT_TEXT = "FF000000";
const REPORT_TRAILING_COLUMNS_TO_HIDE = 40;
const REPORT_LINK_LABEL = "Clique aqui";

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

function columnLetter(columnNumber: number) {
  let dividend = columnNumber;
  let columnName = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

function getWorksheetContentBounds(worksheet: ExcelJS.Worksheet) {
  return {
    rowCount: Math.max(worksheet.actualRowCount, worksheet.rowCount, 1),
    columnCount: Math.max(worksheet.actualColumnCount, worksheet.columnCount, 1),
  };
}

function applyCompactWorksheetView(
  worksheet: ExcelJS.Worksheet,
  {
    rowCount,
    columnCount,
    freezeHeader = false,
  }: { rowCount: number; columnCount: number; freezeHeader?: boolean },
) {
  worksheet.views = [
    freezeHeader
      ? { state: "frozen", ySplit: 1, showGridLines: false }
      : { state: "normal", showGridLines: false },
  ];
  worksheet.pageSetup = {
    ...worksheet.pageSetup,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printArea: `A1:${columnLetter(columnCount)}${rowCount}`,
  };

  for (
    let columnNumber = columnCount + 1;
    columnNumber <= columnCount + REPORT_TRAILING_COLUMNS_TO_HIDE;
    columnNumber += 1
  ) {
    worksheet.getColumn(columnNumber).hidden = true;
  }
}

function pdfUrlCellValue(value?: string | null): ExcelJS.CellValue {
  const text = value?.trim();
  if (!text) {
    return EMPTY_VALUE;
  }

  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      return sanitizeSpreadsheetText(text);
    }

    return {
      text: REPORT_LINK_LABEL,
      hyperlink: url.toString(),
    };
  } catch {
    return sanitizeSpreadsheetText(text);
  }
}

function isHyperlinkValue(value: ExcelJS.CellValue): value is ExcelJS.CellHyperlinkValue {
  return typeof value === "object" && value !== null && "hyperlink" in value;
}

function styleHyperlinkColumn(worksheet: ExcelJS.Worksheet, key: string) {
  worksheet.getColumn(key).eachCell((cell, rowNumber) => {
    if (rowNumber === 1 || !isHyperlinkValue(cell.value)) {
      return;
    }

    cell.font = { name: "Calibri", size: 11, color: { argb: REPORT_RED }, underline: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
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
  const bounds = getWorksheetContentBounds(worksheet);
  worksheet.properties.tabColor = { argb: REPORT_RED };
  const header = worksheet.getRow(1);
  header.font = { name: "Calibri", size: 11, bold: true, color: { argb: REPORT_WHITE } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_RED } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 22;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const fillColor = rowNumber % 2 === 0 ? REPORT_ZEBRA_GRAY : REPORT_WHITE;

    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: REPORT_TEXT } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      cell.border = {
        bottom: { style: "thin", color: { argb: REPORT_BORDER_GRAY } },
      };
    });
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: bounds.columnCount },
  };
  applyCompactWorksheetView(worksheet, { ...bounds, freezeHeader: true });
}

function styleOverview(worksheet: ExcelJS.Worksheet) {
  const bounds = getWorksheetContentBounds(worksheet);
  worksheet.properties.tabColor = { argb: REPORT_RED };
  worksheet.mergeCells("A1:B1");
  worksheet.getRow(1).height = 24;

  const titleCell = worksheet.getCell("A1");
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: REPORT_WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_RED } };
  titleCell.alignment = { vertical: "middle" };

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const fillColor = rowNumber % 2 === 0 ? REPORT_WHITE : REPORT_ZEBRA_GRAY;

    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: REPORT_TEXT } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      cell.border = {
        bottom: { style: "thin", color: { argb: REPORT_BORDER_GRAY } },
      };
    });
  }

  worksheet.getColumn(1).font = { name: "Calibri", bold: true, color: { argb: REPORT_TEXT } };
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: REPORT_WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_RED } };
  titleCell.alignment = { vertical: "middle" };
  applyCompactWorksheetView(worksheet, bounds);
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
  styleOverview(overview);

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
      pdfUrl: pdfUrlCellValue(item.pdfUrl),
    })),
  );
  styleTable(details);
  styleHyperlinkColumn(details, "pdfUrl");

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
