import type { ContentAdvisory } from "../ContentAdvisory";

export interface ContentAdvisoryProvider {
  // Guide parental par identifiant IMDb (« tt1375666 »). Un identifiant absent de la réponse n'en a pas.
  // AdvisoryUnavailableError si la source refuse nos requêtes.
  advisories(imdbIds: string[]): Promise<Map<string, ContentAdvisory>>;
}

// La source du guide parental est injoignable ou refuse nos requêtes.
export class AdvisoryUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
