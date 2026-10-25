// Seuil des alertes de baisse : celui des préférences, sinon le seuil par défaut (aussi si la lecture échoue).

import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import { DEFAULT_PRICE_THRESHOLD, type PriceThreshold } from "@/domain/PriceHistory";

export async function readPriceThreshold(preferences: PreferencesRepository): Promise<PriceThreshold> {
  try {
    return (await preferences.get())?.priceDropThreshold ?? DEFAULT_PRICE_THRESHOLD;
  } catch (error) {
    console.error(error);
    return DEFAULT_PRICE_THRESHOLD;
  }
}
