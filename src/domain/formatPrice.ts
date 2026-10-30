// Un formateur par devise, créé une fois.
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
