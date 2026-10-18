"use client";

// Disponibilités d'un titre, lot de pays par lot (runBatches) : les pays prioritaires d'abord, seuls,
// puis 2 lots en cours au plus. Les résultats s'affichent à mesure qu'ils arrivent.
// Les lots reçus sont mémorisés : « Réessayer » ne redemande que les autres, avec le même mode (cache ou non).

import { useCallback, useEffect, useRef, useState } from "react";
import { countryBatches } from "@/application/catalog/countryBatches";
import { runBatches } from "@/application/catalog/runBatches";
import type { Offer } from "@/domain/Offer";
import { apiFetch } from "./apiFetch";

const BATCHES = countryBatches();
const TOTAL_COUNTRIES = BATCHES.reduce((sum, batch) => sum + batch.length, 0);
// Lots en cours au plus, après le premier : volume vers JustWatch inchangé, concurrence modérée.
const CONCURRENCY = 2;

// « loading » : des lots sont en cours ; « stopped » : arrêt après une erreur ; « done » : tous les lots sont reçus.
export type LoadStatus = "loading" | "stopped" | "done";

type AvailabilityBody = { offers: Record<string, Offer[]>; checkedAt: Record<string, string> };

export function useAvailabilityBatches(id: string) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [checkedAt, setCheckedAt] = useState<Record<string, string>>({});
  const [received, setReceived] = useState<ReadonlySet<number>>(() => new Set());
  const [status, setStatus] = useState<LoadStatus>("loading");

  const receivedRef = useRef(new Set<number>());
  const refreshRef = useRef(false);
  const controller = useRef<AbortController | null>(null);

  // Avec `refresh`, le cache serveur est ignoré ; le mode est mémorisé pour que « Réessayer » le conserve.
  const load = useCallback(
    async (refresh: boolean) => {
      refreshRef.current = refresh;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setStatus("loading");

      const missing = BATCHES.map((_, index) => index).filter((index) => !receivedRef.current.has(index));
      const result = await runBatches(
        missing,
        async (index) => {
          const response = await apiFetch(
            `/api/titles/${encodeURIComponent(id)}/availability?countries=${BATCHES[index].join(",")}${refresh ? "&refresh=1" : ""}`,
            current.signal,
          );
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as AvailabilityBody;
          if (current.signal.aborted) return;
          receivedRef.current.add(index);
          setReceived(new Set(receivedRef.current));
          setOffers((previous) => [...previous, ...Object.values(body.offers).flat()]);
          setCheckedAt((previous) => ({ ...previous, ...body.checkedAt }));
        },
        { concurrency: CONCURRENCY, isAborted: () => current.signal.aborted },
      );
      // 503, erreur réseau ou autre : arrêt propre, on garde ce qui est affiché.
      if (result !== "aborted") setStatus(result);
    },
    [id],
  );

  const reset = useCallback(() => {
    receivedRef.current = new Set();
    setReceived(new Set());
    setOffers([]);
    setCheckedAt({});
  }, []);

  useEffect(() => {
    reset();
    void load(false);
    return () => controller.current?.abort();
  }, [id, load, reset]);

  const retry = useCallback(() => void load(refreshRef.current), [load]);

  // Repart de zéro en ignorant le cache serveur.
  const refresh = useCallback(() => {
    reset();
    void load(true);
  }, [load, reset]);

  const checkedCountries = [...received].reduce((sum, index) => sum + BATCHES[index].length, 0);
  return {
    offers,
    checkedAt,
    status,
    checkedCountries,
    missingCountries: TOTAL_COUNTRIES - checkedCountries,
    totalCountries: TOTAL_COUNTRIES,
    retry,
    refresh,
  };
}
