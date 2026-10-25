import type { Platform } from "./Offer";
import type { PricedType } from "./PriceHistory";
import type { Title } from "./Title";

// État d'un titre de la liste à voir lors de la dernière vérification quotidienne.
export type WatchStatus = {
  titleId: string;
  // Abonnements où le titre est disponible, sous la forme « FR:8 » (pays:plateforme).
  atHome: string[];
  // Toutes les offres en abonnement trouvées dans les pays vérifiés (« FR:8 »), pour recalculer
  // le badge « disponible chez moi » quand les abonnements changent. Absent des anciens états.
  flatrate?: string[];
  // Au moins une offre en audio français dans les pays vérifiés.
  frenchAudio: boolean;
  checkedAt: Date;
};

export type AlertKind = "AT_HOME" | "FRENCH_AUDIO" | "PRICE_DROP";

// Pour PRICE_DROP : l'ancien et le nouveau prix.
export type AlertPrice = { previous: number; value: number; currency: string; monetizationType: PricedType };

// Nouveauté signalée sur l'accueil.
export type Alert = {
  id: string;
  kind: AlertKind;
  title: Pick<Title, "id" | "name" | "posterUrl">;
  // Pour AT_HOME : la plateforme et le pays de l'abonnement ; pour PRICE_DROP : ceux de l'offre.
  platform: Platform | null;
  country: string | null;
  // Pour PRICE_DROP : l'ancien et le nouveau prix.
  price?: AlertPrice | null;
  createdAt: Date;
};
