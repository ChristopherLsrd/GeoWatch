"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";

// Seuls les champs affichés sont typés ici.
type CardItem = { title: { id: string; name: string; posterUrl: string | null } };

type State = { kind: "loading" } | { kind: "ready"; items: CardItem[] } | { kind: "error" };

// Liste à voir de l'accueil : affiche et titre uniquement, chaque carte mène à la page du titre.
export function WatchlistCards() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/watchlist", controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { items: CardItem[] };
        if (!controller.signal.aborted) setState({ kind: "ready", items: body.items });
      } catch {
        if (!controller.signal.aborted) setState({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, []);

  if (state.kind === "loading") return null;

  return (
    <section className="watch-cards" aria-labelledby="watch-cards-heading">
      <div className="watch-cards-head">
        <h2 id="watch-cards-heading">Ma liste à voir</h2>
        <Link href="/liste" className="muted">
          Tout voir / modifier
        </Link>
      </div>
      {state.kind === "error" ? (
        <p className="muted">Liste à voir indisponible pour le moment.</p>
      ) : state.items.length === 0 ? (
        <p className="muted">Votre liste à voir est vide.</p>
      ) : (
        <ul className="card-grid">
          {state.items.map(({ title }) => (
            <li key={title.id}>
              <Link href={`/titre/${encodeURIComponent(title.id)}`} className="card">
                {title.posterUrl ? (
                  <img className="card-poster" src={title.posterUrl} alt="" loading="lazy" />
                ) : (
                  <div className="card-poster" />
                )}
                <span className="card-title">{title.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
