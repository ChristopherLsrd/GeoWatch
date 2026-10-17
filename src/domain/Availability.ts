import type { CountryCode } from "./Country";
import type { Offer } from "./Offer";

// Offres d'un titre dans un pays à un instant donné. Une liste vide veut dire
// « vérifié, non disponible dans ce pays ».
export type Availability = {
  titleId: string;
  country: CountryCode;
  offers: Offer[];
  fetchedAt: Date;
};
