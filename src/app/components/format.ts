// 148 -> « 2 h 28 » ; 120 -> « 2 h » ; 45 -> « 45 min ».
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

// « 2010 (2 h 28) », « 2010 », « (2 h 28) » ou chaîne vide.
export function yearWithRuntime(year: number | null | undefined, runtime: number | null | undefined): string {
  const parts: string[] = [];
  if (year != null) parts.push(String(year));
  if (runtime) parts.push(`(${formatRuntime(runtime)})`);
  return parts.join(" ");
}
