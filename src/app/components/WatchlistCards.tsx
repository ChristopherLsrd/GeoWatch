"use client";

import Link from "next/link";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { yearWithRuntime } from "./format";
import { directorsLabel } from "./HomeBadge";
import { TitleCard } from "./TitleCard";
import { useWatchlist } from "./useWatchlist";
import { useWatchlistBrowser, WatchlistToolbar } from "./WatchlistToolbar";

// Liste à voir de l'accueil : affiche, titre, année et réalisateur ; chaque carte mène à la page du titre.
export function WatchlistCards() {
  const { state } = useWatchlist();
  const items = state.kind === "ready" ? state.items : [];
  const browser = useWatchlistBrowser(items, "geowatch:sort:home", "geowatch:filters:home");

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
                    <TitleCard
                      id={title.id}
                      name={title.name}
                      posterUrl={title.posterUrl}
                      meta={[yearLabel, director]}
                      availableAtHome={item.availableAtHome}
                      imdbScore={item.details?.imdbScore}
                      tmdbScore={item.details?.tmdbScore}
                      priceDrop={item.priceDrop}
                    />
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
