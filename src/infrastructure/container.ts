// Assemblage des dépendances côté serveur.

import { GetTitle } from "@/application/catalog/GetTitle";
import { GetTitleAvailability } from "@/application/catalog/GetTitleAvailability";
import { SearchTitles } from "@/application/catalog/SearchTitles";
import { SearchHistory } from "@/application/history/SearchHistory";
import { Subscriptions } from "@/application/subscriptions/Subscriptions";
import { Watchlist } from "@/application/watchlist/Watchlist";
import { JustWatchGraphqlCatalog } from "./justwatch/JustWatchGraphqlCatalog";
import { getDb } from "./mongo/client";
import { MongoAvailabilityCache } from "./mongo/MongoAvailabilityCache";
import { MongoSearchHistoryRepository } from "./mongo/MongoSearchHistoryRepository";
import { MongoSubscriptionRepository } from "./mongo/MongoSubscriptionRepository";
import { MongoWatchlistRepository } from "./mongo/MongoWatchlistRepository";

const catalog = new JustWatchGraphqlCatalog({ country: "FR", language: "fr" });
const availabilityCache = new MongoAvailabilityCache(getDb);

export const searchTitles = new SearchTitles(catalog);
export const getTitle = new GetTitle(catalog);
export const getTitleAvailability = new GetTitleAvailability(catalog, availabilityCache);
export const watchlist = new Watchlist(new MongoWatchlistRepository(getDb), catalog);
export const subscriptions = new Subscriptions(new MongoSubscriptionRepository(getDb), catalog);
export const searchHistory = new SearchHistory(new MongoSearchHistoryRepository(getDb));
