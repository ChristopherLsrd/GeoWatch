"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "./apiFetch";
import { yearWithRuntime } from "./format";
import { directorsLabel, HomeBadge, type OverviewItem } from "./HomeBadge";
import { useWatchlistBrowser, WatchlistToolbar } from "./WatchlistToolbar";

type CardItem = OverviewItem;

type State =
  | { kind: "loading" }
  | { kind: "ready"; items: CardItem[] }
  | { kind: "error" };

// Liste à voir de l'accueil : affiche, titre, année et réalisateur ; chaque carte mène à la page du titre.
export function WatchlistCards() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [items, setItems] = useState<CardItem[]>([]);
  const browser = useWatchlistBrowser(items, "geowatch:sort:home");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/watchlist", controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { items: CardItem[] };
        if (controller.signal.aborted) return;
        setItems(body.items);
        setState({ kind: "ready", items: body.items });
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
        <h2 id="watch-cards-heading" className="section-title">
          <BookmarkIcon aria-hidden="true" />
          Ma liste à voir
        </h2>
        <Link href="/liste">
          Tout voir / modifier
        </Link>
      </div>
      {state.kind === "error" ? (
        <p className="muted">Liste à voir indisponible pour le moment.</p>
      ) : state.items.length === 0 ? (
        <p className="muted">Votre liste à voir est vide.</p>
      ) : (
        <>
          <WatchlistToolbar browser={browser} idPrefix="home-toolbar" />
          {browser.visible.length === 0 ? (
            <p className="muted toolbar-empty">Aucun titre ne correspond.</p>
          ) : (
            <ul className="card-grid">
              {browser.visible.map((item) => {
                const { title } = item;
                const director = directorsLabel(item.details);
                const yearLabel = yearWithRuntime(title.year, item.details?.runtime);
                return (
                  <li key={title.id}>
                    <Link
                      href={`/titre/${encodeURIComponent(title.id)}`}
                      className="card"
                    >
                      <span className="card-media">
                        {title.posterUrl ? (
                          <img
                            className="card-poster"
                            src={title.posterUrl}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span className="card-poster" />
                        )}
                        <HomeBadge item={item} />
                      </span>
                      <span className="card-title">{title.name}</span>
                      {yearLabel && <span className="card-meta">{yearLabel}</span>}
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
        </>
      )}
    </section>
  );
}
