import type { Platform } from "./Offer";
import type { Title } from "./Title";

// État d'un titre de la liste à voir lors de la dernière vérification quotidienne.
export type WatchStatus = {
  titleId: string;
  // Abonnements où le titre est disponible, sous la forme « FR:8 » (pays:plateforme).
  atHome: string[];
  // Au moins une offre en audio français dans les pays vérifiés.
  frenchAudio: boolean;
  checkedAt: Date;
};

export type AlertKind = "AT_HOME" | "FRENCH_AUDIO";

// Nouveauté signalée sur l'accueil.
export type Alert = {
  id: string;
  kind: AlertKind;
  title: Pick<Title, "id" | "name" | "posterUrl">;
  // Pour AT_HOME : la plateforme et le pays de l'abonnement.
  platform: Platform | null;
  country: string | null;
  createdAt: Date;
};
