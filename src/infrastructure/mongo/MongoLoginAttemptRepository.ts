import type { Collection, Db } from "mongodb";
import type { LoginAttempt, LoginAttemptRepository } from "@/application/auth/Login";

type LoginAttemptDocument = {
  _id: string;
  failures: number;
  windowStart: Date;
  blockedUntil: Date | null;
  // Mongo supprime le document à cette date (index TTL).
  expiresAt: Date;
};

const RETENTION_MS = 24 * 3600 * 1000;

export class MongoLoginAttemptRepository implements LoginAttemptRepository {
  private readonly collection: Collection<LoginAttemptDocument>;
  private indexReady: Promise<string> | null = null;

  constructor(db: Db) {
    this.collection = db.collection<LoginAttemptDocument>("loginAttempts");
  }

  async find(key: string): Promise<LoginAttempt | null> {
    const doc = await this.collection.findOne({ _id: key });
    return doc ? { key: doc._id, failures: doc.failures, windowStart: doc.windowStart, blockedUntil: doc.blockedUntil } : null;
  }

  async save(attempt: LoginAttempt): Promise<void> {
    this.indexReady ??= this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.indexReady;
    const { key, ...fields } = attempt;
    await this.collection.replaceOne(
      { _id: key },
      { ...fields, expiresAt: new Date(Date.now() + RETENTION_MS) },
      { upsert: true },
    );
  }

  async delete(key: string): Promise<void> {
    await this.collection.deleteOne({ _id: key });
  }
}
