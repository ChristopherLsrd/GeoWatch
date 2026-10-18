import { describe, expect, it } from "vitest";
import { runBatches } from "./runBatches";

// Laisse passer quelques tours de micro-tâches : simule une réponse réseau.
const tick = async (n = 3) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

function recorder(fail: (index: number) => boolean = () => false, duration: (index: number) => number = () => 3) {
  const log: string[] = [];
  let active = 0;
  let maxActive = 0;
  const load = async (index: number) => {
    log.push(`start ${index}`);
    active++;
    maxActive = Math.max(maxActive, active);
    await tick(duration(index));
    active--;
    if (fail(index)) {
      log.push(`fail ${index}`);
      throw new Error("503");
    }
    log.push(`end ${index}`);
  };
  return { load, log, maxActive: () => maxActive };
}

const notAborted = () => false;

describe("runBatches", () => {
  it("fait partir le lot 0 seul, puis les suivants 2 par 2", async () => {
    const r = recorder();
    const result = await runBatches([0, 1, 2, 3, 4], r.load, { concurrency: 2, isAborted: notAborted });
    expect(result).toBe("done");
    // Le lot 0 est terminé avant que le lot 1 parte.
    expect(r.log.slice(0, 3)).toEqual(["start 0", "end 0", "start 1"]);
    expect(r.log[3]).toBe("start 2");
    expect(r.maxActive()).toBe(2);
    expect(r.log.filter((l) => l.startsWith("end")).sort()).toEqual(["end 0", "end 1", "end 2", "end 3", "end 4"]);
  });

  it("ne lance plus rien après un échec, mais laisse finir le lot en cours", async () => {
    // Le lot 2 échoue vite, et le lot 1 se termine après.
    const r = recorder((i) => i === 2, (i) => (i === 2 ? 1 : 3));
    const result = await runBatches([0, 1, 2, 3, 4], r.load, { concurrency: 2, isAborted: notAborted });
    expect(result).toBe("stopped");
    expect(r.log).toEqual(["start 0", "end 0", "start 1", "start 2", "fail 2", "end 1"]);
  });

  it("s'arrête sans rien lancer d'autre si le lot 0 échoue", async () => {
    const r = recorder((i) => i === 0);
    expect(await runBatches([0, 1, 2], r.load, { concurrency: 2, isAborted: notAborted })).toBe("stopped");
    expect(r.log).toEqual(["start 0", "fail 0"]);
  });

  it("reprend directement 2 par 2 quand le lot 0 est déjà reçu", async () => {
    const r = recorder();
    expect(await runBatches([3, 5, 6], r.load, { concurrency: 2, isAborted: notAborted })).toBe("done");
    expect(r.log.slice(0, 2)).toEqual(["start 3", "start 5"]);
    expect(r.maxActive()).toBe(2);
  });

  it("renvoie aborted et ne lance plus rien après l'abandon", async () => {
    let aborted = false;
    const r = recorder();
    const load = async (index: number) => {
      await r.load(index);
      if (index === 1) aborted = true;
    };
    const result = await runBatches([0, 1, 2, 3, 4, 5], load, { concurrency: 2, isAborted: () => aborted });
    expect(result).toBe("aborted");
    // Les lots 1 et 2 étaient déjà partis ; aucun autre ne part ensuite.
    expect(r.log.filter((l) => l.startsWith("start"))).toEqual(["start 0", "start 1", "start 2"]);
  });

  it("traite un échec dû à l'abandon comme un abandon", async () => {
    let aborted = false;
    const load = async () => {
      aborted = true;
      throw new DOMException("aborted", "AbortError");
    };
    expect(await runBatches([0, 1], load, { concurrency: 2, isAborted: () => aborted })).toBe("aborted");
  });

  it("ne fait rien sans lot", async () => {
    const r = recorder();
    expect(await runBatches([], r.load, { concurrency: 2, isAborted: notAborted })).toBe("done");
    expect(r.log).toEqual([]);
  });
});
