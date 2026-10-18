import { describe, expect, it } from "vitest";
import { addTiming, measure, runWithTiming, serverTimingHeader } from "./requestTiming";

describe("requestTiming", () => {
  it("cumule les durées ajoutées pendant la requête", async () => {
    const { result, timings, totalMs } = await runWithTiming(async () => {
      addTiming("mongo", 2);
      addTiming("mongo", 3.5);
      addTiming("justwatch", 10);
      return "ok";
    });
    expect(result).toBe("ok");
    expect(timings).toEqual({ mongo: 5.5, justwatch: 10 });
    expect(totalMs).toBeGreaterThanOrEqual(0);
  });

  it("isole deux requêtes simultanées", async () => {
    const pause = () => new Promise((resolve) => setTimeout(resolve, 5));
    const [a, b] = await Promise.all([
      runWithTiming(async () => {
        addTiming("mongo", 1);
        await pause();
        addTiming("mongo", 1);
      }),
      runWithTiming(async () => {
        await pause();
        addTiming("mongo", 7);
      }),
    ]);
    expect(a.timings.mongo).toBe(2);
    expect(b.timings.mongo).toBe(7);
  });

  it("ne fait rien hors d'une requête mesurée", () => {
    expect(() => addTiming("mongo", 1)).not.toThrow();
  });

  it("measure chronomètre aussi une fonction qui échoue", async () => {
    const { timings } = await runWithTiming(async () => {
      await expect(
        measure("justwatch", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error("panne");
        }),
      ).rejects.toThrow("panne");
    });
    expect(timings.justwatch).toBeGreaterThan(0);
  });

  it("formate l'en-tête avec une décimale", () => {
    expect(serverTimingHeader({ mongo: 12.345, justwatch: 0 }, 250.06)).toBe(
      "mongo;dur=12.3, justwatch;dur=0.0, total;dur=250.1",
    );
  });
});
