import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildArticleReportWorkbook, sanitizeSpreadsheetText } from "../src/modules/reports/article-report.workbook.js";

test("builds an XLSX report with overview, numeric summaries and detailed works", async () => {
  const buffer = await buildArticleReportWorkbook({
    generatedAt: new Date("2026-06-01T12:00:00.000Z"),
    filters: { status: "all" },
    filterLabels: { event: "Congresso UNA" },
    items: [
      {
        title: "Pesquisa em Saúde",
        authors: ["Ana Silva"],
        area: "Saúde",
        courses: ["Enfermagem", "Biomedicina"],
        eventTitle: "Congresso UNA",
        eventYear: 2026,
        modality: "Resumo Expandido",
        status: "PUBLISHED",
        pages: "1-5",
        pdfUrl: "https://example.com/article-1.pdf",
        submittedAt: new Date("2026-05-20T12:00:00.000Z"),
      },
      {
        title: "=HYPERLINK(\"https://example.com\")",
        authors: ["Carlos Lima"],
        area: "Tecnologia",
        courses: [],
        eventTitle: "Congresso UNA",
        eventYear: 2026,
        status: "DRAFT",
        submittedAt: new Date("2026-05-21T12:00:00.000Z"),
      },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map((worksheet) => worksheet.name), [
    "Visão geral",
    "Resumo por área",
    "Resumo por curso",
    "Trabalhos detalhados",
  ]);

  const overview = workbook.getWorksheet("Visão geral")!;
  assert.equal(overview.getCell("B4").value, 2);
  assert.equal(overview.getCell("B6").value, "Congresso UNA");

  const courseSummary = workbook.getWorksheet("Resumo por curso")!;
  assert.equal(courseSummary.getCell("A2").value, "Biomedicina");
  assert.equal(courseSummary.getCell("B2").value, 1);
  assert.equal(courseSummary.getCell("A4").value, "Não informado");
  assert.equal(courseSummary.getCell("B4").value, 1);

  const details = workbook.getWorksheet("Trabalhos detalhados")!;
  assert.equal(details.getCell("A3").value, "'=HYPERLINK(\"https://example.com\")");
  assert.equal(details.getCell("D2").value, "Enfermagem, Biomedicina");
});

test("neutralizes spreadsheet formula prefixes from text fields", () => {
  assert.equal(sanitizeSpreadsheetText("=1+1"), "'=1+1");
  assert.equal(sanitizeSpreadsheetText("@SUM(A1:A2)"), "'@SUM(A1:A2)");
  assert.equal(sanitizeSpreadsheetText("  +1+1"), "'+1+1");
  assert.equal(sanitizeSpreadsheetText("-1+1"), "'-1+1");
  assert.equal(sanitizeSpreadsheetText("Título comum"), "Título comum");
});
