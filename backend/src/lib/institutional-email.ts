export const DEFAULT_INSTITUTIONAL_EMAIL_DOMAINS = ["acervo.edu", "ulife.com.br"] as const;

const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function parseInstitutionalEmailDomains(value: string) {
  const domains = Array.from(
    new Set(
      value
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (!domains.length) {
    throw new Error("INSTITUTIONAL_EMAIL_DOMAINS must contain at least one domain.");
  }

  const invalidDomain = domains.find((domain) => !DOMAIN_PATTERN.test(domain));
  if (invalidDomain) {
    throw new Error(`Invalid institutional email domain: ${invalidDomain}`);
  }

  return domains;
}

export function resolveInstitutionalEmailDomains(options: {
  domains?: string;
  legacyDomain?: string;
}) {
  if (options.domains?.trim()) {
    return parseInstitutionalEmailDomains(options.domains);
  }

  const fallbackDomains = options.legacyDomain?.trim()
    ? [options.legacyDomain, DEFAULT_INSTITUTIONAL_EMAIL_DOMAINS[1]]
    : DEFAULT_INSTITUTIONAL_EMAIL_DOMAINS;

  return parseInstitutionalEmailDomains(fallbackDomains.join(","));
}

export function isInstitutionalEmail(email: string, allowedDomains: readonly string[]) {
  const [localPart, domain, ...extraParts] = normalizeEmailAddress(email).split("@");

  return Boolean(localPart && domain && !extraParts.length && allowedDomains.includes(domain));
}

export function formatInstitutionalEmailDomains(domains: readonly string[]) {
  return domains.map((domain) => `@${domain}`).join(" ou ");
}
