"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";
import { directorsLabel, HomeBadge, type OverviewItem } from "./HomeBadge";

type CardItem = OverviewItem;

type State = { kind: "loading" } | { kind: "ready"; items: CardItem[] } | { kind: "error" };

// Liste à voir de l'accueil : affiche, titre, année et réalisateur ; chaque carte mène à la page du titre.
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
          {state.items.map((item) => {
            const { title } = item;
            const director = directorsLabel(item.details);
            return (
              <li key={title.id}>
                <Link href={`/titre/${encodeURIComponent(title.id)}`} className="card">
                  <span className="card-media">
                    {title.posterUrl ? (
                      <img className="card-poster" src={title.posterUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="card-poster" />
                    )}
                    <HomeBadge item={item} />
                  </span>
                  <span className="card-title">{title.name}</span>
                  {title.year !== null && <span className="card-meta">{title.year}</span>}
                  {director && (
                    <span className="card-meta" title={director}>
                      {director}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
