import type { CountryCode } from "./Country";
import type { Platform } from "./Offer";

// Abonnement de l'utilisateur à une plateforme, dans un pays.
export type Subscription = {
  platform: Platform;
  country: CountryCode;
};

export const DEFAULT_SUBSCRIPTION_COUNTRY: CountryCode = "FR";
