import type { Availability } from "../Availability";
import type { CountryCode } from "../Country";

export interface AvailabilityCache {
  // Disponibilités en cache vérifiées le jour `day` (jour de Paris), pour ceux des pays demandés qui y sont.
  find(titleId: string, countries: CountryCode[], day: string): Promise<Availability[]>;
  save(availabilities: Availability[]): Promise<void>;
}
