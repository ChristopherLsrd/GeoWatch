"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";
import { removeFromWatchlist } from "./watchlistApi";
import { WatchlistNote } from "./WatchlistNote";

type State =
  | { kind: "loading" }
  | { kind: "ready"; inList: boolean; note: string }
  | { kind: "error" };

// Bouton « Ajouter à ma liste » / « Retirer de ma liste » et note perso, sur la page titre.
export function WatchlistButton({ titleId }: { titleId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    setMessage(null);
    (async () => {
      try {
        const response = await apiFetch(`/api/watchlist/${encodeURIComponent(titleId)}`, controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { item: { note: string } | null };
        if (!controller.signal.aborted) {
          setState({ kind: "ready", inList: body.item !== null, note: body.item?.note ?? "" });
        }
      } catch {
        if (!controller.signal.aborted) setState({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [titleId]);

  if (state.kind === "loading") return null;
  if (state.kind === "error") return <p className="muted">Ma liste est indisponible pour le moment.</p>;

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId }),
      });
      if (response.status === 503) {
        setMessage("JustWatch est momentanément indisponible, réessayez.");
      } else if (response.status === 404) {
        setMessage("Titre introuvable.");
      } else if (!response.ok) {
        setMessage("Impossible d'ajouter le titre, réessayez.");
      } else {
        const body = (await response.json()) as { item: { note: string } };
        setState({ kind: "ready", inList: true, note: body.item.note });
      }
    } catch {
      setMessage("Impossible d'ajouter le titre, réessayez.");
    }
    setBusy(false);
  }

  async function remove(note: string) {
    setBusy(true);
    setMessage(null);
    const result = await removeFromWatchlist(titleId, note);
    if (result.removed) setState({ kind: "ready", inList: false, note: "" });
    else if (result.error) setMessage(result.error);
    setBusy(false);
  }

  return (
    <div className="watchlist-box">
      {state.inList ? (
        <button type="button" onClick={() => void remove(state.note)} disabled={busy}>
          Retirer de ma liste
        </button>
      ) : (
        <button type="button" className="primary" onClick={() => void add()} disabled={busy}>
          Ajouter à ma liste
        </button>
      )}
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      {state.inList && (
        <WatchlistNote
          titleId={titleId}
          note={state.note}
          onSaved={(note) => setState({ kind: "ready", inList: true, note })}
        />
      )}
    </div>
  );
}
