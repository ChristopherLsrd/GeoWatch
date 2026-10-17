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
