// Jour calendaire à Paris (« 2026-10-17 ») : une disponibilité vérifiée un autre jour est périmée.

const parisDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDay(date: Date): string {
  return parisDayFormat.format(date);
}

const DAY_MS = 86_400_000;

// Nombre de jours de `from` à `to` (« 2026-10-17 » → « 2026-10-18 » : 1).
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
