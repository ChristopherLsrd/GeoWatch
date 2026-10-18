// Interrogation des lots de pays d'un titre : le lot 0 (pays prioritaires) part seul pour un premier
// affichage rapide, puis les suivants partent `concurrency` par `concurrency`, dans l'ordre de la file.
// Au premier échec, plus rien ne part ; les lots déjà en cours se terminent et leurs résultats sont gardés.

export type BatchRunResult = "done" | "stopped" | "aborted";

export async function runBatches(
  // Lots à demander, en ordre croissant : le lot 0, s'il manque, est donc en tête.
  indices: number[],
  // Charge un lot et affiche son résultat ; lève une erreur en cas d'échec.
  load: (index: number) => Promise<void>,
  options: { concurrency: number; isAborted: () => boolean },
): Promise<BatchRunResult> {
  const { concurrency, isAborted } = options;
  const queue = [...indices];
  let failed = false;

  if (queue[0] === 0 && !isAborted()) {
    queue.shift();
    try {
      await load(0);
    } catch {
      failed = true;
    }
  }

  const worker = async () => {
    while (queue.length > 0 && !failed && !isAborted()) {
      const index = queue.shift()!;
      try {
        await load(index);
      } catch {
        failed = true;
      }
    }
  };
  if (!failed) await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

  if (isAborted()) return "aborted";
  return failed ? "stopped" : "done";
}
