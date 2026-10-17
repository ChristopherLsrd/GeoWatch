"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { countryBatches } from "@/application/catalog/countryBatches";
import type { Offer } from "@/domain/Offer";
import type { Title } from "@/domain/Title";
import { apiFetch } from "./apiFetch";
import { OfferResults } from "./OfferResults";

const BATCHES = countryBatches();
const TOTAL_COUNTRIES = BATCHES.reduce((sum, batch) => sum + batch.length, 0);

type TitleState =
  | { kind: "loading" }
  | { kind: "ready"; title: Title }
  | { kind: "not_found" }
  | { kind: "error" };

// « loading » : un lot est en cours ; « stopped » : arrêt après une erreur ; « done » : tous les lots sont faits.
type LoadStatus = "loading" | "stopped" | "done";

function externalLinks(title: Title) {
  const links: { label: string; href: string }[] = [];
  if (title.imdbId) links.push({ label: "IMDb", href: `https://www.imdb.com/title/${title.imdbId}` });
  if (title.tmdbId) {
    const kind = title.type === "MOVIE" ? "movie" : "tv";
    links.push({ label: "TMDB", href: `https://www.themoviedb.org/${kind}/${title.tmdbId}` });
  }
  return links;
}

export function TitleView({ id }: { id: string }) {
  const [titleState, setTitleState] = useState<TitleState>({ kind: "loading" });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [nextBatch, setNextBatch] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const nextBatchRef = useRef(0);
  const controller = useRef<AbortController | null>(null);

  // Interroge les lots l'un après l'autre à partir de `start`, en affichant les résultats au fil de l'eau.
  const loadBatches = useCallback(
    async (start: number) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setStatus("loading");

      for (let i = start; i < BATCHES.length; i++) {
        try {
          const response = await apiFetch(
            `/api/titles/${encodeURIComponent(id)}/availability?countries=${BATCHES[i].join(",")}`,
            current.signal,
          );
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as { offers: Record<string, Offer[]> };
          if (current.signal.aborted) return;
          setOffers((previous) => [...previous, ...Object.values(body.offers).flat()]);
          nextBatchRef.current = i + 1;
          setNextBatch(i + 1);
        } catch {
          // 503, erreur réseau ou autre : arrêt propre, on garde ce qui est affiché.
          if (!current.signal.aborted) setStatus("stopped");
          return;
        }
      }
      setStatus("done");
    },
    [id],
  );

  useEffect(() => {
    const current = new AbortController();
    setTitleState({ kind: "loading" });
    setOffers([]);
    setNextBatch(0);
    nextBatchRef.current = 0;

    (async () => {
      try {
        const response = await apiFetch(`/api/titles/${encodeURIComponent(id)}`, current.signal);
        if (response.status === 404) return setTitleState({ kind: "not_found" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { title: Title };
        if (!current.signal.aborted) setTitleState({ kind: "ready", title: body.title });
      } catch {
        if (!current.signal.aborted) setTitleState({ kind: "error" });
      }
    })();

    void loadBatches(0);
    return () => {
      current.abort();
      controller.current?.abort();
    };
  }, [id, loadBatches]);

  const checkedCountries = BATCHES.slice(0, nextBatch).reduce((sum, batch) => sum + batch.length, 0);
  const missingCountries = TOTAL_COUNTRIES - checkedCountries;

  return (
    <div>
      {titleState.kind === "loading" && <p className="muted">Chargement du titre…</p>}
      {titleState.kind === "not_found" && <p role="alert">Titre introuvable.</p>}
      {titleState.kind === "error" && (
        <p role="alert" className="error">
          Impossible de charger le titre.
        </p>
      )}
      {titleState.kind === "ready" && <TitleHeader title={titleState.title} />}

      {titleState.kind !== "not_found" && (
        <>
          <div className={status === "stopped" ? "progress warn" : "progress"} aria-live="polite">
            {status === "loading" && (
              <span>
                {checkedCountries} / {TOTAL_COUNTRIES} pays vérifiés…
              </span>
            )}
            {status === "done" && (
              <span>
                {TOTAL_COUNTRIES} / {TOTAL_COUNTRIES} pays vérifiés
              </span>
            )}
            {status === "stopped" && (
              <>
                <span>
                  {checkedCountries} / {TOTAL_COUNTRIES} pays vérifiés · {missingCountries} pays non vérifiés
                  (JustWatch ne répond pas pour le moment)
                </span>
                <button type="button" onClick={() => void loadBatches(nextBatchRef.current)}>
                  Réessayer
                </button>
              </>
            )}
            <div className="progress-bar" aria-hidden="true">
              <div style={{ width: `${(checkedCountries / TOTAL_COUNTRIES) * 100}%` }} />
            </div>
          </div>

          <OfferResults offers={offers} complete={status === "done"} />
        </>
      )}
    </div>
  );
}

function TitleHeader({ title }: { title: Title }) {
  const links = externalLinks(title);
  return (
    <header className="title-head">
      {title.posterUrl ? (
        <img className="poster poster-lg" src={title.posterUrl} alt={`Affiche de ${title.name}`} />
      ) : (
        <div className="poster poster-lg" />
      )}
      <div>
        <h1>{title.name}</h1>
        <div className="muted">
          {title.year ?? "année inconnue"} · {title.type === "MOVIE" ? "Film" : "Série"}
        </div>
        {links.length > 0 && (
          <div className="links">
            {links.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
