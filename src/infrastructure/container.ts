// Assemblage des dépendances côté serveur.

import { GetTitle } from "@/application/catalog/GetTitle";
import { GetTitleAvailability } from "@/application/catalog/GetTitleAvailability";
import { SearchTitles } from "@/application/catalog/SearchTitles";
import { JustWatchGraphqlCatalog } from "./justwatch/JustWatchGraphqlCatalog";
import { getDb } from "./mongo/client";
import { MongoAvailabilityCache } from "./mongo/MongoAvailabilityCache";

const catalog = new JustWatchGraphqlCatalog({ country: "FR", language: "fr" });
const availabilityCache = new MongoAvailabilityCache(getDb);

export const searchTitles = new SearchTitles(catalog);
export const getTitle = new GetTitle(catalog);
export const getTitleAvailability = new GetTitleAvailability(catalog, availabilityCache);
