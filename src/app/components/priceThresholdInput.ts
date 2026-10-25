export type PriceThreshold = { amount: number; percent: number };

function parseField(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// Analyse les deux champs du seuil (virgule acceptée). Un champ vide ou non numérique
// donne null : sans cela, Number("") vaudrait 0, soit « toute baisse », sans que l'utilisateur l'ait voulu.
export function parsePriceThreshold(amount: string, percent: string): PriceThreshold | null {
  const parsedAmount = parseField(amount);
  const parsedPercent = parseField(percent);
  if (parsedAmount === null || parsedPercent === null) return null;
  return { amount: parsedAmount, percent: parsedPercent };
}
