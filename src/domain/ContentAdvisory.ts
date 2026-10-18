// Raisons d'une classification d'âge (guide parental d'IMDb) : une intensité par catégorie.

export const ADVISORY_CATEGORIES = ["nudity", "violence", "profanity", "alcohol", "frightening"] as const;
export type AdvisoryCategory = (typeof ADVISORY_CATEGORIES)[number];

export const SEVERITIES = ["none", "mild", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Une catégorie absente est non renseignée.
export type ContentAdvisory = Partial<Record<AdvisoryCategory, Severity>>;

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITIES as readonly string[]).includes(value);
}

// Vrai si chaque catégorie demandée a exactement l'intensité voulue.
// Un titre sans guide parental ne correspond jamais à un filtre non vide.
export function matchesAdvisory(advisory: ContentAdvisory | null | undefined, wanted: ContentAdvisory): boolean {
  const entries = Object.entries(wanted) as [AdvisoryCategory, Severity][];
  if (entries.length === 0) return true;
  if (!advisory) return false;
  return entries.every(([category, severity]) => advisory[category] === severity);
}
