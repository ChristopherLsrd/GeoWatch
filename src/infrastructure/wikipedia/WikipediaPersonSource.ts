// Biographie et photo d'une personne via le résumé de sa page Wikipédia en français.
// Page cherchée par le nom : on écarte les homonymies et les pages dont la description ne parle pas de cinéma.

import type { ExternalPersonInfo, PersonInfoHint, PersonInfoSource } from "@/domain/ports/PersonInfoSource";
import { normalizeName } from "../tmdb/TmdbPersonSource";

const SUMMARY_URL = "https://fr.wikipedia.org/api/rest_v1/page/summary/";
const TIMEOUT_MS = 5_000;
// Comparés à la description sans accents ni majuscules.
const CINEMA_WORDS = ["realisat", "acteur", "actrice", "cineaste", "comedien", "scenariste", "producteur", "productrice"];

type WikipediaSummary = {
  type?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

export function isCinemaSummary(summary: WikipediaSummary): boolean {
  if (summary.type === "disambiguation") return false;
  const description = normalizeName(summary.description ?? "");
  return CINEMA_WORDS.some((word) => description.includes(word));
}

export class WikipediaPersonSource implements PersonInfoSource {
  readonly source = "wikipedia" as const;
  private readonly fetch: typeof fetch;

  constructor(options: { fetch?: typeof fetch } = {}) {
    this.fetch = options.fetch ?? fetch;
  }

  async find(hint: PersonInfoHint): Promise<ExternalPersonInfo | null> {
    const page = encodeURIComponent(hint.name.trim().replace(/ /g, "_"));
    try {
      const response = await this.fetch(`${SUMMARY_URL}${page}`, {
        headers: { "User-Agent": "GeoWatch/1.0 (outil personnel)", Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const summary = (await response.json()) as WikipediaSummary;
      if (!isCinemaSummary(summary)) return null;
      const photoUrl = summary.thumbnail?.source ?? null;
      return {
        biography: summary.extract?.trim() || null,
        photoUrl,
        photoPageUrl: photoUrl ? commonsFilePage(photoUrl) : null,
        deathDate: null,
        sourceUrl: summary.content_urls?.desktop?.page ?? `https://fr.wikipedia.org/wiki/${page}`,
      };
    } catch {
      return null;
    }
  }
}

// Page d'une image de Wikimedia, où figurent son auteur et sa licence (attribution CC BY-SA par lien) :
// « …/wikipedia/commons/thumb/9/95/Nom.jpg/320px-Nom.jpg » → « commons.wikimedia.org/wiki/File:Nom.jpg ».
// Une image propre à un Wikipédia (« …/wikipedia/fr/… ») a sa page « Fichier: » sur ce Wikipédia.
export function commonsFilePage(imageUrl: string): string | null {
  const match = imageUrl.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/([a-z-]+)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  if (!match) return null;
  const [, wiki, file] = match;
  return wiki === "commons" ? `https://commons.wikimedia.org/wiki/File:${file}` : `https://${wiki}.wikipedia.org/wiki/Fichier:${file}`;
}
