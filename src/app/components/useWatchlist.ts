"use client";

// Liste à voir partagée par l'accueil et « Ma liste » :
// 1. copie locale affichée tout de suite ;
// 2. GET /api/watchlist la remplace ;
// 3. tant que `pending` > 0, POST /api/watchlist/check en boucle, un appel à la fois, et fusion à mesure.
//    Arrêt quand rien ne reste, sur une erreur, aux plafonds, ou quand la page est quittée.

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./apiFetch";
import type { OverviewItem } from "./HomeBadge";
import { browserStorage, mergeItems, nextCheckAllowed, readLocalWatchlist, writeLocalWatchlist } from "./watchlistLocal";

export type WatchlistState = { kind: "loading" } | { kind: "ready"; items: OverviewItem[] } | { kind: "error" };

type CheckResponse = { items: OverviewItem[]; pending: number; checked: number; completed: number };

export function useWatchlist() {
  const [state, setState] = useState<WatchlistState>({ kind: "loading" });
  const controller = useRef<AbortController | null>(null);

  // Met à jour l'état et la copie locale ensemble.
  const update = useCallback((fn: (items: OverviewItem[]) => OverviewItem[]) => {
    setState((previous) => {
      if (previous.kind !== "ready") return previous;
      const items = fn(previous.items);
      writeLocalWatchlist(browserStorage(), items);
      return { kind: "ready", items };
    });
  }, []);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const { signal } = current;

    // La copie locale est lue après le premier rendu (pas pendant), pour un HTML identique côté serveur.
    const local = readLocalWatchlist(browserStorage());
    setState(local ? { kind: "ready", items: local } : { kind: "loading" });

    let pending = 0;
    try {
      const response = await apiFetch("/api/watchlist", signal);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { items: OverviewItem[]; pending: number };
      if (signal.aborted) return;
      writeLocalWatchlist(browserStorage(), body.items);
      setState({ kind: "ready", items: body.items });
      pending = body.pending;
    } catch {
      // Sans réponse du serveur, la copie locale reste affichée si elle existe.
      if (!signal.aborted && !local) setState({ kind: "error" });
      return;
    }

    const totals = { checked: 0, completed: 0 };
    while (!signal.aborted && nextCheckAllowed(totals, pending)) {
      try {
        const response = await apiFetch("/api/watchlist/check", { method: "POST", signal });
        if (!response.ok) return; // 503 ou autre : les badges restent inconnus, on réessaiera à la prochaine ouverture.
        const body = (await response.json()) as CheckResponse;
        if (signal.aborted) return;
        totals.checked += body.checked;
        totals.completed += body.completed;
        pending = body.pending;
        if (body.items.length > 0) update((items) => mergeItems(items, body.items));
        // Aucun progrès : on évite de boucler sur un titre que le catalogue ne connaît plus.
        if (body.checked === 0 && body.completed === 0) return;
      } catch {
        return;
      }
    }
  }, [update]);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  return { state, update, reload: load };
}
