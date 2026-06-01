import assert from "node:assert/strict";
import test from "node:test";
import { exceedsArticleReportLimit, MAX_ARTICLE_REPORT_ITEMS } from "../src/modules/reports/article-report.policy.js";

test("limits in-memory XLSX report generation", () => {
  assert.equal(exceedsArticleReportLimit(MAX_ARTICLE_REPORT_ITEMS), false);
  assert.equal(exceedsArticleReportLimit(MAX_ARTICLE_REPORT_ITEMS + 1), true);
});
