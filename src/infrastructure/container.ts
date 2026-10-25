// Assemblage des dépendances côté serveur.

import { GetTitle } from "@/application/catalog/GetTitle";
import { GetTitleAvailability } from "@/application/catalog/GetTitleAvailability";
import { SearchTitles } from "@/application/catalog/SearchTitles";
import { Alerts } from "@/application/daily/Alerts";
import { DailyCheck } from "@/application/daily/DailyCheck";
import { GetPerson } from "@/application/people/GetPerson";
import { ImportLetterboxd } from "@/application/import/ImportLetterboxd";
import { SearchHistory } from "@/application/history/SearchHistory";
import { ListRatedTitles } from "@/application/ratings/ListRatedTitles";
import { UserPreferences } from "@/application/preferences/UserPreferences";
import { Subscriptions } from "@/application/subscriptions/Subscriptions";
import { ResolveSharedLink } from "@/application/share/ResolveSharedLink";
import { Watchlist } from "@/application/watchlist/Watchlist";
import { WatchlistCheck } from "@/application/watchlist/WatchlistCheck";
import { WatchlistOverview } from "@/application/watchlist/WatchlistOverview";
import { ImdbParentsGuide } from "./imdb/ImdbParentsGuide";
import { JustWatchGraphqlCatalog } from "./justwatch/JustWatchGraphqlCatalog";
import { JustWatchRatingCatalog } from "./justwatch/JustWatchRatingCatalog";
import { JustWatchPersonCatalog } from "./justwatch/JustWatchPersonCatalog";
import { JustWatchTitlePaths } from "./justwatch/JustWatchTitlePaths";
import { LetterboxdHttpReader } from "./letterboxd/LetterboxdHttpReader";
import { getDb } from "./mongo/client";
import { TmdbExternalTitleLookup } from "./tmdb/TmdbExternalTitleLookup";
import { TmdbTitleExtras } from "./tmdb/TmdbTitleExtras";
import { TmdbPersonSource } from "./tmdb/TmdbPersonSource";
import { WikipediaPersonSource } from "./wikipedia/WikipediaPersonSource";
import { CachedContentAdvisories } from "./mongo/CachedContentAdvisories";
import { MongoAlertRepository } from "./mongo/MongoAlertRepository";
import { MongoAvailabilityCache } from "./mongo/MongoAvailabilityCache";
import { MongoPersonCache } from "./mongo/MongoPersonCache";
import { MongoPriceHistoryRepository } from "./mongo/MongoPriceHistoryRepository";
import { MongoPreferencesRepository } from "./mongo/MongoPreferencesRepository";
import { MongoSearchHistoryRepository } from "./mongo/MongoSearchHistoryRepository";
import { MongoSubscriptionRepository } from "./mongo/MongoSubscriptionRepository";
import { MongoWatchlistRepository } from "./mongo/MongoWatchlistRepository";
import { MongoWatchStatusRepository } from "./mongo/MongoWatchStatusRepository";

const catalog = new JustWatchGraphqlCatalog({ country: "FR", language: "fr" });
const availabilityCache = new MongoAvailabilityCache(getDb);
const watchlistRepository = new MongoWatchlistRepository(getDb);
const subscriptionRepository = new MongoSubscriptionRepository(getDb);
const alertRepository = new MongoAlertRepository(getDb);

export const getPerson = new GetPerson(
  new JustWatchPersonCatalog(),
  [new TmdbPersonSource({ apiKey: process.env.TMDB_API_KEY }), new WikipediaPersonSource()],
  new MongoPersonCache(getDb),
  subscriptionRepository,
);

export const searchTitles = new SearchTitles(catalog);
export const resolveSharedLink = new ResolveSharedLink(
  catalog,
  new TmdbExternalTitleLookup({ apiKey: process.env.TMDB_API_KEY }),
  new LetterboxdHttpReader(),
  new JustWatchTitlePaths(),
);
export const contentAdvisories = new CachedContentAdvisories(new ImdbParentsGuide(), getDb);
export const getTitle = new GetTitle(
  catalog,
  new TmdbTitleExtras({ apiKey: process.env.TMDB_API_KEY }),
  contentAdvisories,
);
export const ratingCatalog = new JustWatchRatingCatalog();
export const listRatedTitles = new ListRatedTitles(ratingCatalog, contentAdvisories, subscriptionRepository);
export const getTitleAvailability = new GetTitleAvailability(catalog, availabilityCache);
export const watchlist = new Watchlist(watchlistRepository, catalog);
export const importLetterboxd = new ImportLetterboxd(catalog, watchlist);
export const subscriptions = new Subscriptions(subscriptionRepository, catalog);
export const searchHistory = new SearchHistory(new MongoSearchHistoryRepository(getDb));
const preferencesRepository = new MongoPreferencesRepository(getDb);
const priceHistoryRepository = new MongoPriceHistoryRepository(getDb);
export const userPreferences = new UserPreferences(preferencesRepository);
export const alerts = new Alerts(alertRepository);
const watchStatusRepository = new MongoWatchStatusRepository(getDb);
export const dailyCheck = new DailyCheck(
  watchlistRepository,
  subscriptionRepository,
  getTitleAvailability,
  watchStatusRepository,
  alertRepository,
  priceHistoryRepository,
  preferencesRepository,
);
export const watchlistOverview = new WatchlistOverview(watchlist, watchStatusRepository, subscriptionRepository);
export const watchlistCheck = new WatchlistCheck(watchlist, watchStatusRepository, subscriptionRepository, (title, subs) =>
  dailyCheck.checkTitle(title, subs),
);
