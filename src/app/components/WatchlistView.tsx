"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";
import { yearWithRuntime } from "./format";
import { directorsLabel, HomeBadge, type OverviewItem } from "./HomeBadge";
import { removeFromWatchlist } from "./watchlistApi";
import { WatchlistNote } from "./WatchlistNote";
import { useShowNotes, useWatchlistBrowser, WatchlistToolbar } from "./WatchlistToolbar";

// L'API renvoie la date d'ajout en chaîne ISO.
type Item = OverviewItem;

type State = { kind: "loading" } | { kind: "ready"; items: Item[] } | { kind: "error" };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

// Note d'un titre : toujours dépliée, ou repliée derrière un petit bouton quand les notes sont masquées.
function NoteSlot({ item, showAll, onSaved }: { item: Item; showAll: boolean; onSaved: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  if (showAll || open) {
    return (
      <>
        <WatchlistNote titleId={item.title.id} note={item.note} onSaved={onSaved} />
        {!showAll && (
          <button type="button" className="link-button note-toggle" onClick={() => setOpen(false)}>
            Masquer la note
          </button>
        )}
      </>
    );
  }
  return (
    <button type="button" className="note-toggle" onClick={() => setOpen(true)}>
      {item.note ? "Note" : "Ajouter une note"}
    </button>
  );
}

export function WatchlistView() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const items = state.kind === "ready" ? state.items : [];
  const browser = useWatchlistBrowser(items, "geowatch:sort:list");
  const [showNotes, setShowNotes] = useShowNotes("geowatch:list:notes");
  const [error, setError] = useState<string | null>(null);

  async function load(signal?: AbortSignal) {
    setState({ kind: "loading" });
    try {
      const response = await apiFetch("/api/watchlist", signal);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { items: Item[] };
      if (!signal?.aborted) setState({ kind: "ready", items: body.items });
    } catch {
      if (!signal?.aborted) setState({ kind: "error" });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  async function remove(item: Item) {
    setError(null);
    const result = await removeFromWatchlist(item.title.id, item.note);
    if (result.removed) {
      setState((previous) =>
        previous.kind === "ready"
          ? { kind: "ready", items: previous.items.filter((other) => other.title.id !== item.title.id) }
          : previous,
      );
    } else if (result.error) {
      setError(result.error);
    }
  }

  function noteSaved(titleId: string, note: string) {
    setState((previous) =>
      previous.kind === "ready"
        ? { kind: "ready", items: previous.items.map((i) => (i.title.id === titleId ? { ...i, note } : i)) }
        : previous,
    );
  }

  if (state.kind === "loading") return <p className="muted">Chargement de votre liste…</p>;
  if (state.kind === "error") {
    return (
      <div>
        <p role="alert" className="error">
          Impossible de charger votre liste.
        </p>
        <button type="button" onClick={() => void load()}>
          Réessayer
        </button>
      </div>
    );
  }
  if (state.items.length === 0) {
    return (
      <p>
        Votre liste est vide. Cherchez un titre pour l&apos;ajouter. <Link href="/">Retour à la recherche</Link>
      </p>
    );
  }

  return (
    <div>
      <WatchlistToolbar
        browser={browser}
        search
        idPrefix="list-toolbar"
        notes={{ show: showNotes, onChange: setShowNotes }}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {browser.visible.length === 0 && <p className="muted toolbar-empty">Aucun titre ne correspond.</p>}
      <ul className="results">
        {browser.visible.map((item) => (
          <li key={item.title.id} className="watch-item">
            <div className="poster-wrap">
              {item.title.posterUrl ? (
                <img className="poster" src={item.title.posterUrl} alt={`Affiche de ${item.title.name}`} />
              ) : (
                <div className="poster" />
              )}
              <HomeBadge item={item} />
            </div>
            <div className="watch-body">
              <div className="watch-head">
                <div>
                  <Link href={`/titre/${encodeURIComponent(item.title.id)}`} className="result-title">
                    {item.title.name}
                  </Link>
                  <div className="muted">
                    {yearWithRuntime(item.title.year, item.details?.runtime) || "année inconnue"} · {item.title.type === "MOVIE" ? "Film" : "Série"} · ajouté le{" "}
                    {formatDate(item.addedAt)}
                  </div>
                  {directorsLabel(item.details) && (
                    <div className="muted">De {directorsLabel(item.details)}</div>
                  )}
                </div>
                <button type="button" onClick={() => void remove(item)}>
                  Retirer
                </button>
              </div>
              <NoteSlot item={item} showAll={showNotes} onSaved={(note) => noteSaved(item.title.id, note)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
