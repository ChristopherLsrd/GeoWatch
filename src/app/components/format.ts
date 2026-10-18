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

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// « 1970-07-30 » → « 30 juillet 1970 » (date sans heure, lue en UTC pour éviter tout décalage).
function formatIsoDate(iso: string): string {
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}

function ageAt(birth: string, at: Date): number {
  const b = new Date(`${birth}T00:00:00Z`);
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  const before = at.getUTCMonth() < b.getUTCMonth() || (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate());
  if (before) age -= 1;
  return age;
}

// « Naissance : 30 juillet 1970 (56 ans) » ou « 31 mai 1930 – 2 août 2020 (90 ans) ».
export function formatLifeDates(birthDate: string | null, deathDate: string | null, today: Date): string {
  if (!birthDate) return "";
  if (deathDate) return `${formatIsoDate(birthDate)} – ${formatIsoDate(deathDate)} (${ageAt(birthDate, new Date(`${deathDate}T00:00:00Z`))} ans)`;
  return `Naissance : ${formatIsoDate(birthDate)} (${ageAt(birthDate, today)} ans)`;
}
