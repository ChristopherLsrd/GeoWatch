import { MongoClient, type Db } from "mongodb";

// Un seul client par instance de fonction, réutilisé entre les invocations
// (et entre les rechargements à chaud en développement).
const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

export function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant");
  globalForMongo.mongoClient ??= new MongoClient(uri).connect();
  return globalForMongo.mongoClient.then((client) => client.db(process.env.MONGODB_DB ?? "geowatch"));
}
