// Titres d'une classification d'âge, avec le badge « Chez moi ».
// Le filtre sur les raisons (guide parental) n'est pas connu du catalogue : on lit ses pages
// et on garde les titres qui correspondent, jusqu'à une page pleine ou MAX_RATING_PAGES pages lues.

import { matchesAdvisory, type ContentAdvisory } from "@/domain/ContentAdvisory";
import type { FilmographyCard } from "@/domain/Person";
import type { ContentAdvisoryProvider } from "@/domain/ports/ContentAdvisoryProvider";
import { RATING_PAGE_SIZE, type RatedTitle, type RatingCatalog, type RatingQuery } from "@/domain/ports/RatingCatalog";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { Subscription } from "@/domain/Subscription";

export const MAX_RATING_PAGES = 3;

// total : null avec un filtre sur les raisons (inconnu). homeAvailable : l'utilisateur a un abonnement dans ce pays.
export type RatedTitlesPage = { titles: FilmographyCard[]; total: number | null; nextCursor: string | null; homeAvailable: boolean };

export class ListRatedTitles {
  constructor(
    private readonly catalog: RatingCatalog,
    private readonly advisories: ContentAdvisoryProvider,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(query: RatingQuery, advisory: ContentAdvisory): Promise<RatedTitlesPage> {
    const subscriptions = await this.subscriptions.list();
    const homePlatformIds = subscriptions.filter((s) => s.country === query.country).map((s) => s.platform.id);
    const homeAvailable = homePlatformIds.length > 0;

    let page = await this.catalog.list(query, homePlatformIds);
    if (Object.keys(advisory).length === 0) {
      return { titles: await this.cards(page.titles, subscriptions), total: page.total, nextCursor: page.nextCursor, homeAvailable };
    }

    const kept: RatedTitle[] = [];
    for (let read = 1; ; read++) {
      const ids = page.titles.map((t) => t.imdbId).filter((id): id is string => !!id);
      const guides = await this.advisories.advisories(ids);
      kept.push(...page.titles.filter((t) => t.imdbId && matchesAdvisory(guides.get(t.imdbId), advisory)));
      if (kept.length >= RATING_PAGE_SIZE || !page.nextCursor || read >= MAX_RATING_PAGES) break;
      page = await this.catalog.list({ ...query, after: page.nextCursor }, homePlatformIds);
    }
    return { titles: await this.cards(kept, subscriptions), total: null, nextCursor: page.nextCursor, homeAvailable };
  }

  // Badge « Chez moi » : une panne des offres n'empêche pas la liste, affichée sans badge.
  private async cards(titles: RatedTitle[], subscriptions: Subscription[]): Promise<FilmographyCard[]> {
    const countries = [...new Set(subscriptions.map((s) => s.country))];
    let flatrate = new Map<string, Partial<Record<string, string[]>>>();
    if (titles.length > 0 && countries.length > 0) {
      try {
        flatrate = await this.catalog.flatrate(titles.map((t) => t.id), countries);
      } catch (error) {
        console.error("Offres en abonnement indisponibles", error);
      }
    }
    return titles.map((title) => ({
      ...title,
      availableAtHome: subscriptions.filter((s) => flatrate.get(title.id)?.[s.country]?.includes(s.platform.id) ?? false),
    }));
  }
}
