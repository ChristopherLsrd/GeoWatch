import { MongoClient, type Db } from "mongodb";
import { addTiming } from "../timing/requestTiming";

// Un seul client par instance de fonction, réutilisé entre les invocations
// (et entre les rechargements à chaud en développement).
const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

export function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant");
  globalForMongo.mongoClient ??= createClient(uri).connect();
  return globalForMongo.mongoClient.then((client) => client.db(process.env.MONGODB_DB ?? "geowatch"));
}

// Surveillance des commandes : leur durée alimente l'en-tête Server-Timing de la requête en cours.
function createClient(uri: string): MongoClient {
  const client = new MongoClient(uri, { monitorCommands: true });
  client.on("commandSucceeded", (event) => addTiming("mongo", event.duration));
  client.on("commandFailed", (event) => addTiming("mongo", event.duration));
  return client;
}
