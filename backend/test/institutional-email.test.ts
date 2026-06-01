import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INSTITUTIONAL_EMAIL_DOMAINS,
  formatInstitutionalEmailDomains,
  isInstitutionalEmail,
  normalizeEmailAddress,
  parseInstitutionalEmailDomains,
  resolveInstitutionalEmailDomains,
} from "../src/lib/institutional-email.js";

test("uses ACERVO, ULife and UNA professor domains by default", () => {
  assert.deepEqual(resolveInstitutionalEmailDomains({}), DEFAULT_INSTITUTIONAL_EMAIL_DOMAINS);
});

test("keeps the legacy domain configuration and adds current institutional domains", () => {
  assert.deepEqual(resolveInstitutionalEmailDomains({ legacyDomain: "acervo.edu" }), [
    "acervo.edu",
    "ulife.com.br",
    "prof.una.br",
  ]);
});

test("uses an explicit normalized domain allowlist when configured", () => {
  assert.deepEqual(
    resolveInstitutionalEmailDomains({ domains: " ACERVO.EDU,ulife.com.br,acervo.edu " }),
    ["acervo.edu", "ulife.com.br"],
  );
});

test("accepts only exact institutional domains", () => {
  const domains = parseInstitutionalEmailDomains("acervo.edu,ulife.com.br,prof.una.br");

  assert.equal(isInstitutionalEmail("coordenacao@acervo.edu", domains), true);
  assert.equal(isInstitutionalEmail("  ALUNO@ULIFE.COM.BR ", domains), true);
  assert.equal(isInstitutionalEmail("professor@prof.una.br", domains), true);
  assert.equal(isInstitutionalEmail("aluno@sub.ulife.com.br", domains), false);
  assert.equal(isInstitutionalEmail("aluno@notulife.com.br", domains), false);
  assert.equal(isInstitutionalEmail("aluno@evil.example@ulife.com.br", domains), false);
});

test("normalizes addresses and formats the allowed domain message", () => {
  assert.equal(normalizeEmailAddress("  ALUNO@ULIFE.COM.BR "), "aluno@ulife.com.br");
  assert.equal(
    formatInstitutionalEmailDomains(["acervo.edu", "ulife.com.br", "prof.una.br"]),
    "@acervo.edu ou @ulife.com.br ou @prof.una.br",
  );
});

test("rejects empty or malformed domain configuration", () => {
  assert.throws(() => parseInstitutionalEmailDomains(""), /at least one domain/);
  assert.throws(() => parseInstitutionalEmailDomains("@ulife.com.br"), /Invalid institutional email domain/);
});
