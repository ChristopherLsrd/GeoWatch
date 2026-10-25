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

// Date ISO coupée à 10 caractères (« 1970-07-30T00:00:00Z » → « 1970-07-30 »), lue en UTC ; null si invalide.
function parseIsoDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// « 1970-07-30 » → « 30 juillet 1970 » (date sans heure, lue en UTC pour éviter tout décalage).
function formatDate(date: Date): string {
  return longDate.format(date);
}

function ageAt(b: Date, at: Date): number {
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  const before = at.getUTCMonth() < b.getUTCMonth() || (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate());
  if (before) age -= 1;
  return age;
}

// « Naissance : 30 juillet 1970 (56 ans) », « 31 mai 1930 – 2 août 2020 (90 ans) » ou « Décès : 2 août 2020 ».
export function formatLifeDates(birthDate: string | null, deathDate: string | null, today: Date): string {
  const birth = parseIsoDate(birthDate);
  const death = parseIsoDate(deathDate);
  if (birth && death) return `${formatDate(birth)} – ${formatDate(death)} (${ageAt(birth, death)} ans)`;
  if (birth) return `Naissance : ${formatDate(birth)} (${ageAt(birth, today)} ans)`;
  if (death) return `Décès : ${formatDate(death)}`;
  return "";
}

// Un formateur par devise, créé une fois (comme scoreFormat).
const priceFormats = new Map<string, Intl.NumberFormat>();

// Null si la devise n'est pas un code ISO 4217 valide (Intl lève alors une RangeError).
function priceFormat(currency: string): Intl.NumberFormat | null {
  let format = priceFormats.get(currency);
  if (!format) {
    try {
      format = new Intl.NumberFormat("fr-FR", { style: "currency", currency });
    } catch {
      return null;
    }
    priceFormats.set(currency, format);
  }
  return format;
}

// « 4,99 € » ; devise invalide : « 4,99 EURO ».
export function formatPrice(value: number, currency: string): string {
  const format = priceFormat(currency);
  return format ? format.format(value) : `${value.toFixed(2).replace(".", ",")} ${currency}`;
}
