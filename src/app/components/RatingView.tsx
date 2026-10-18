"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_RATING_FILTERS,
  isRatingListKnown,
  parseRatingParams,
  ratingSearchParams,
  type RatingFilters,
} from "@/application/ratings/ratingParams";
import type { RatedTitlesPage } from "@/application/ratings/ListRatedTitles";
import { AGE_RATINGS } from "@/config/ageRatings";
import { ADVISORY_CATEGORIES, SEVERITIES, isSeverity } from "@/domain/ContentAdvisory";
import { countryFlag, countryName } from "@/domain/Country";
import type { FilmographyCard } from "@/domain/Person";
import type { RatingSort } from "@/domain/ports/RatingCatalog";
import { ADVISORY_LABELS, SEVERITY_LABELS, ratingHref } from "./advisoryLabels";
import { apiFetch } from "./apiFetch";
import { yearWithRuntime } from "./format";
import { TitleCard } from "./TitleCard";

type Status = "loading" | "ready" | "error" | "failed" | "advisory_error" | "not_found";
type Genre = { code: string; label: string };

const SORT_LABELS: Record<RatingSort, string> = {
  popular: "Popularité",
  imdb: "Note IMDb",
  year: "Année (récent d'abord)",
  alpha: "Ordre alphabétique",
};

const SEARCH_DELAY_MS = 400;

function apiUrl(country: string, code: string, filters: RatingFilters, after: string | null): string {
  return `/api/classifications/${encodeURIComponent(country)}/${encodeURIComponent(code)}?${ratingSearchParams(filters, after)}`;
}

// Filtres modifiés par l'utilisateur : le type et le tri ne comptent pas (ils restent après « Effacer »).
function hasActiveFilters(filters: RatingFilters): boolean {
  return (
    ratingSearchParams({ ...filters, type: null, sort: DEFAULT_RATING_FILTERS.sort }).toString() !==
    ratingSearchParams(DEFAULT_RATING_FILTERS).toString()
  );
}

export function RatingView({ country, code, initialSearch }: { country: string; code: string; initialSearch: string }) {
  const known = isRatingListKnown(country, code);
  const router = useRouter();
  const [filters, setFilters] = useState<RatingFilters>(() => parseRatingParams(new URLSearchParams(initialSearch)).filters);
  const [titles, setTitles] = useState<FilmographyCard[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [homeAvailable, setHomeAvailable] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [moreEmpty, setMoreEmpty] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [yearFromInput, setYearFromInput] = useState(filters.yearFrom?.toString() ?? "");
  const [yearToInput, setYearToInput] = useState(filters.yearTo?.toString() ?? "");
  const [genres, setGenres] = useState<Genre[] | null>(null);
  const moreController = useRef<AbortController | null>(null);

  function update(patch: Partial<RatingFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  // Premier chargement et à chaque changement de filtres : annule la requête en cours, repart de zéro.
  useEffect(() => {
    if (!known) return;
    const controller = new AbortController();
    moreController.current?.abort();
    setTitles([]);
    setTotal(null);
    setNextCursor(null);
    setMoreError(null);
    setMoreEmpty(false);
    setLoadingMore(false);
    setStatus("loading");
    (async () => {
      try {
        const response = await apiFetch(apiUrl(country, code, filters, null), controller.signal);
        if (controller.signal.aborted) return;
        if (response.status === 404) return setStatus("not_found");
        if (response.status === 503) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          if (controller.signal.aborted) return;
          return setStatus(body?.error === "advisory_unavailable" ? "advisory_error" : "error");
        }
        if (!response.ok) return setStatus("failed");
        const page = (await response.json()) as RatedTitlesPage;
        if (controller.signal.aborted) return;
        setTitles(page.titles);
        setTotal(page.total);
        setNextCursor(page.nextCursor);
        setHomeAvailable(page.homeAvailable);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [country, code, filters, attempt, known]);

  // L'URL suit les filtres (sans le curseur).
  useEffect(() => {
    if (!known) return;
    const qs = ratingSearchParams(filters).toString();
    router.replace(`/classification/${encodeURIComponent(country)}/${encodeURIComponent(code)}${qs ? `?${qs}` : ""}`, {
      scroll: false,
    });
  }, [filters, country, code, known, router]);

  // La recherche s'applique 400 ms après la dernière frappe.
  useEffect(() => {
    const value = searchInput.trim() || null;
    if (value === filters.search) return;
    const timer = setTimeout(() => setFilters((current) => ({ ...current, search: value })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // Genres : une seule fois ; sans réponse, le filtre est masqué.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/classifications/genres", controller.signal);
        if (!response.ok) return;
        const body = (await response.json()) as { genres: Genre[] };
        if (!controller.signal.aborted) setGenres(body.genres);
      } catch {
        // filtre masqué
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => () => moreController.current?.abort(), []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);
    setMoreError(null);
    setMoreEmpty(false);
    try {
      const response = await apiFetch(apiUrl(country, code, filters, nextCursor), controller.signal);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const body =
          response.status === 503 ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
        if (controller.signal.aborted) return;
        return setMoreError(
          body?.error === "advisory_unavailable" ? "Guide parental indisponible." : "Impossible de charger la suite.",
        );
      }
      const page = (await response.json()) as RatedTitlesPage;
      if (controller.signal.aborted) return;
      const added = page.titles.filter((t) => !titles.some((c) => c.id === t.id));
      setTitles((current) => [...current, ...page.titles.filter((t) => !current.some((c) => c.id === t.id))]);
      setNextCursor(page.nextCursor);
      setHomeAvailable(page.homeAvailable);
      setMoreEmpty(added.length === 0 && page.nextCursor !== null);
    } catch {
      if (!controller.signal.aborted) setMoreError("Impossible de charger la suite.");
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  function applyYears() {
    const parse = (value: string) => {
      const n = Number(value);
      return /^\d{4}$/.test(value.trim()) && n >= 1880 && n <= 2100 ? n : null;
    };
    const yearFrom = parse(yearFromInput);
    const yearTo = parse(yearToInput);
    if (yearFrom !== filters.yearFrom || yearTo !== filters.yearTo) update({ yearFrom, yearTo });
  }

  function clearFilters() {
    setSearchInput("");
    setYearFromInput("");
    setYearToInput("");
    setFilters((current) => ({ ...DEFAULT_RATING_FILTERS, type: current.type, sort: current.sort }));
  }

  if (!known) {
    return (
      <div className="title-page">
        <p role="alert">
          Classification inconnue. <Link href="/">Retour à l&apos;accueil</Link>
        </p>
      </div>
    );
  }

  const active = hasActiveFilters(filters);
  const advisoryActive = Object.keys(filters.advisory).length > 0;
  const clearButton = (
    <button type="button" className="ghost" onClick={clearFilters}>
      Effacer les filtres
    </button>
  );

  return (
    <div className="title-page rating-page">
      <header className="rating-head">
        <h1>
          Classification {code} · {countryFlag(country)} {countryName(country)}
        </h1>
        {total !== null && (
          <p className="muted" aria-live="polite">
            {total.toLocaleString("fr-FR")} {total > 1 ? "titres" : "titre"}
          </p>
        )}
        <nav className="rating-codes" aria-label="Classifications">
          {(AGE_RATINGS[country] ?? []).map((c) => (
            <Link
              key={c}
              href={ratingHref(country, c, filters)}
              className={c === code ? "active" : undefined}
              aria-current={c === code ? "page" : undefined}
            >
              {c}
            </Link>
          ))}
        </nav>
        {advisoryActive && (
          <p className="muted rating-note">Filtré sur le guide parental IMDb : les titres sans guide sont exclus.</p>
        )}
      </header>

      <div className="rating-filters">
        <input
          type="search"
          placeholder="Rechercher un titre"
          aria-label="Rechercher un titre"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          aria-label="Type"
          value={filters.type ?? ""}
          onChange={(e) => update({ type: e.target.value === "MOVIE" || e.target.value === "SHOW" ? e.target.value : null })}
        >
          <option value="">Tous</option>
          <option value="MOVIE">Films</option>
          <option value="SHOW">Séries</option>
        </select>
        {genres && genres.length > 0 && (
          <select aria-label="Genre" value={filters.genre ?? ""} onChange={(e) => update({ genre: e.target.value || null })}>
            <option value="">Tous les genres</option>
            {genres.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
        )}
        <div className="rating-years">
          <input
            type="number"
            min={1880}
            max={2100}
            placeholder="De"
            aria-label="Année de début"
            value={yearFromInput}
            onChange={(e) => setYearFromInput(e.target.value)}
            onBlur={applyYears}
            onKeyDown={(e) => e.key === "Enter" && applyYears()}
          />
          <input
            type="number"
            min={1880}
            max={2100}
            placeholder="à"
            aria-label="Année de fin"
            value={yearToInput}
            onChange={(e) => setYearToInput(e.target.value)}
            onBlur={applyYears}
            onKeyDown={(e) => e.key === "Enter" && applyYears()}
          />
        </div>
        <select
          aria-label="Note IMDb"
          value={filters.imdbMin ?? ""}
          onChange={(e) => update({ imdbMin: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Toutes</option>
          <option value="6">6+</option>
          <option value="7">7+</option>
          <option value="8">8+</option>
        </select>
        {homeAvailable && (
          <label className="rating-home">
            <input type="checkbox" checked={filters.homeOnly} onChange={(e) => update({ homeOnly: e.target.checked })} />
            Chez moi seulement
          </label>
        )}
        <select aria-label="Tri" value={filters.sort} onChange={(e) => update({ sort: e.target.value as RatingSort })}>
          {(Object.keys(SORT_LABELS) as RatingSort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        {ADVISORY_CATEGORIES.map((c) => (
          <select
            key={c}
            aria-label={ADVISORY_LABELS[c]}
            value={filters.advisory[c] ?? ""}
            onChange={(e) => {
              const advisory = { ...filters.advisory };
              if (isSeverity(e.target.value)) advisory[c] = e.target.value;
              else delete advisory[c];
              update({ advisory });
            }}
          >
            <option value="">{ADVISORY_LABELS[c]} : toutes</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {ADVISORY_LABELS[c]} : {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        ))}
        {active && clearButton}
      </div>

      <div aria-live="polite">
        {status === "loading" && <p className="muted">Chargement…</p>}
        {status === "not_found" && (
          <p role="alert">
            Classification inconnue. <Link href="/">Retour à l&apos;accueil</Link>
          </p>
        )}
        {(status === "error" || status === "failed" || status === "advisory_error") && (
          <div className="person-error">
            <p role="alert" className="error">
              {status === "error"
                ? "JustWatch ne répond pas pour le moment."
                : status === "failed"
                  ? "Le chargement a échoué."
                  : "Guide parental indisponible."}
            </p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Réessayer
            </button>
          </div>
        )}
        {status === "ready" && titles.length === 0 && !nextCursor && (
          <div className="rating-empty">
            <p className="muted">Aucun titre ne correspond.</p>
            {active && clearButton}
          </div>
        )}
        {status === "ready" && nextCursor && (titles.length === 0 || moreEmpty) && (
          <p className="muted">Aucun titre trouvé pour l&apos;instant dans les titres parcourus.</p>
        )}
      </div>
      {titles.length > 0 && (
        <ul className="card-grid">
          {titles.map((card) => (
            <li key={card.id}>
              <TitleCard
                id={card.id}
                name={card.name}
                posterUrl={card.posterUrl}
                meta={[yearWithRuntime(card.year, card.runtime)]}
                availableAtHome={card.availableAtHome}
                imdbScore={card.imdbScore}
                tmdbScore={card.tmdbScore}
              />
            </li>
          ))}
        </ul>
      )}
      {status === "ready" && moreError && (
        <p role="alert" className="error">
          {moreError}
        </p>
      )}
      {status === "ready" && nextCursor && (
        <div className="rating-more">
          <button type="button" onClick={loadMore} disabled={loadingMore}>
            {moreError ? "Réessayer" : loadingMore ? "Chargement…" : "Voir plus"}
          </button>
        </div>
      )}
    </div>
  );
}
