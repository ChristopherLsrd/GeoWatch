// Mesure du temps passé par requête (Mongo, JustWatch), pour l'en-tête Server-Timing.
// Le contexte suit la requête à travers les appels asynchrones (AsyncLocalStorage) ;
// hors d'une requête mesurée, les durées sont ignorées.

import { AsyncLocalStorage } from "node:async_hooks";

export type TimingKey = "mongo" | "justwatch" | "imdb";

const storage = new AsyncLocalStorage<Record<TimingKey, number>>();

export function addTiming(key: TimingKey, ms: number): void {
  const timings = storage.getStore();
  if (timings) timings[key] += ms;
}

export async function measure<T>(key: TimingKey, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    addTiming(key, performance.now() - start);
  }
}

export async function runWithTiming<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; timings: Record<TimingKey, number>; totalMs: number }> {
  const timings: Record<TimingKey, number> = { mongo: 0, justwatch: 0, imdb: 0 };
  const start = performance.now();
  const result = await storage.run(timings, fn);
  return { result, timings, totalMs: performance.now() - start };
}

export function serverTimingHeader(timings: Record<TimingKey, number>, totalMs: number): string {
  return [
    `mongo;dur=${timings.mongo.toFixed(1)}`,
    `justwatch;dur=${timings.justwatch.toFixed(1)}`,
    `imdb;dur=${timings.imdb.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ].join(", ");
}
