const scoreFormat = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// 8.84 -> « 8,8 ».
export function formatScore(score: number): string {
  return scoreFormat.format(score);
}

// 148 -> « 2h28 » ; 120 -> « 2h » ; 45 -> « 45min ».
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// « 2010 (2h28) », « 2010 », « (2h28) » ou chaîne vide.
export function yearWithRuntime(year: number | null | undefined, runtime: number | null | undefined): string {
  const parts: string[] = [];
  if (year != null) parts.push(String(year));
  if (runtime) parts.push(`(${formatRuntime(runtime)})`);
  return parts.join(" ");
}
