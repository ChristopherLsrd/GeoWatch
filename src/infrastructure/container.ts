// Assemblage des dépendances côté serveur.

import { GetTitle } from "@/application/catalog/GetTitle";
import { GetTitleAvailability } from "@/application/catalog/GetTitleAvailability";
import { SearchTitles } from "@/application/catalog/SearchTitles";
import { Alerts } from "@/application/daily/Alerts";
import { DailyCheck } from "@/application/daily/DailyCheck";
import { SearchHistory } from "@/application/history/SearchHistory";
import { UserPreferences } from "@/application/preferences/UserPreferences";
import { Subscriptions } from "@/application/subscriptions/Subscriptions";
import { Watchlist } from "@/application/watchlist/Watchlist";
import { WatchlistOverview } from "@/application/watchlist/WatchlistOverview";
import { JustWatchGraphqlCatalog } from "./justwatch/JustWatchGraphqlCatalog";
import { getDb } from "./mongo/client";
import { TmdbOriginalLanguage } from "./tmdb/TmdbOriginalLanguage";
import { MongoAlertRepository } from "./mongo/MongoAlertRepository";
import { MongoAvailabilityCache } from "./mongo/MongoAvailabilityCache";
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

export const searchTitles = new SearchTitles(catalog);
export const getTitle = new GetTitle(catalog, new TmdbOriginalLanguage({ apiKey: process.env.TMDB_API_KEY }));
export const getTitleAvailability = new GetTitleAvailability(catalog, availabilityCache);
export const watchlist = new Watchlist(watchlistRepository, catalog);
export const subscriptions = new Subscriptions(subscriptionRepository, catalog);
export const searchHistory = new SearchHistory(new MongoSearchHistoryRepository(getDb));
export const userPreferences = new UserPreferences(new MongoPreferencesRepository(getDb));
export const alerts = new Alerts(alertRepository);
const watchStatusRepository = new MongoWatchStatusRepository(getDb);
export const dailyCheck = new DailyCheck(
  watchlistRepository,
  subscriptionRepository,
  getTitleAvailability,
  watchStatusRepository,
  alertRepository,
);
export const watchlistOverview = new WatchlistOverview(watchlist, watchStatusRepository, subscriptionRepository, (title) =>
  dailyCheck.checkTitle(title),
);
