import { BATCH_SIZE, JUSTWATCH_COUNTRIES, PRIORITY_1, PRIORITY_2 } from "@/config/countries";
import type { CountryCode } from "@/domain/Country";

// Lots de pays à interroger dans l'ordre : priorité 1, priorité 2, puis le reste par lots de BATCH_SIZE.
export function countryBatches(): CountryCode[][] {
  const prioritized = new Set([...PRIORITY_1, ...PRIORITY_2]);
  const others = JUSTWATCH_COUNTRIES.filter((country) => !prioritized.has(country));
  const batches = [PRIORITY_1, PRIORITY_2];
  for (let i = 0; i < others.length; i += BATCH_SIZE) batches.push(others.slice(i, i + BATCH_SIZE));
  return batches.filter((batch) => batch.length > 0);
}
