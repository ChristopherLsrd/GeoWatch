"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowsUpDownIcon, FunnelIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  applicableFilters,
  filterWatchlist,
  NO_SAVED_FILTERS,
  parseSavedFilters,
  sortWatchlist,
  WATCHLIST_SORTS,
  watchlistFacets,
  type SavedWatchlistFilters,
  type WatchlistSort,
} from "@/application/watchlist/browseWatchlist";
import type { OverviewItem } from "./HomeBadge";

type Prefs = { sort: WatchlistSort; reverse: boolean };
const DEFAULT_PREFS: Prefs = { sort: "added", reverse: false };

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la page fonctionne sans mémorisation.
  }
}

function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Stockage indisponible : rien à effacer.
  }
}

function readPrefs(key: string): Prefs {
  try {
    const parsed = JSON.parse(readStorage(key) ?? "null") as Partial<Prefs> | null;
    if (parsed && typeof parsed.sort === "string" && parsed.sort in WATCHLIST_SORTS) {
      return { sort: parsed.sort, reverse: parsed.reverse === true };
    }
  } catch {
    // Valeur illisible : tri par défaut.
  }
  return DEFAULT_PREFS;
}

// État de tri et de filtres d'une liste. Le tri est mémorisé sous `storageKey` ; les filtres
// (hors recherche texte) sous `filtersKey`, s'il est fourni.
export function useWatchlistBrowser(items: OverviewItem[], storageKey: string, filtersKey?: string) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SavedWatchlistFilters>(NO_SAVED_FILTERS);

  // Lecture après l'hydratation, pour que le rendu serveur et client concordent.
  useEffect(() => {
    setPrefs(readPrefs(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (filtersKey) setSaved(parseSavedFilters(readStorage(filtersKey)));
  }, [filtersKey]);

  function updateFilters(patch: Partial<SavedWatchlistFilters>) {
    const next = { ...saved, ...patch };
    setSaved(next);
    if (filtersKey) writeStorage(filtersKey, JSON.stringify(next));
  }

  function updatePrefs(next: Prefs) {
    setPrefs(next);
    writeStorage(storageKey, JSON.stringify(next));
  }

  const facets = useMemo(() => watchlistFacets(items), [items]);
  const { type, director, genre, atHomeOnly } = useMemo(() => applicableFilters(saved, facets), [saved, facets]);

  const visible = useMemo(() => {
    const filtered = filterWatchlist(items, {
      query,
      type: type || undefined,
      directors: director ? [director] : undefined,
      genres: genre ? [genre] : undefined,
      atHomeOnly,
    });
    return sortWatchlist(filtered, prefs.sort, prefs.reverse);
  }, [items, query, type, director, genre, atHomeOnly, prefs]);

  const filtersActive = Boolean(query.trim() || type || director || genre || atHomeOnly);

  return {
    visible,
    total: items.length,
    facets,
    filtersActive,
    sort: prefs.sort,
    reverse: prefs.reverse,
    setSort: (sort: WatchlistSort) => updatePrefs({ ...prefs, sort }),
    toggleReverse: () => updatePrefs({ ...prefs, reverse: !prefs.reverse }),
    query,
    setQuery,
    type,
    setType: (type: SavedWatchlistFilters["type"]) => updateFilters({ type }),
    director,
    setDirector: (director: string) => updateFilters({ director }),
    genre,
    setGenre: (genre: string) => updateFilters({ genre }),
    atHomeOnly,
    setAtHomeOnly: (atHomeOnly: boolean) => updateFilters({ atHomeOnly }),
    reset: () => {
      setQuery("");
      setSaved(NO_SAVED_FILTERS);
      if (filtersKey) removeStorage(filtersKey);
    },
  };
}

export type WatchlistBrowser = ReturnType<typeof useWatchlistBrowser>;

// Interrupteur global « Afficher les notes » de « Ma liste », mémorisé.
export function useShowNotes(storageKey: string): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (readStorage(storageKey) === "0") setShow(false);
  }, [storageKey]);
  return [
    show,
    (next) => {
      setShow(next);
      writeStorage(storageKey, next ? "1" : "0");
    },
  ];
}

export function WatchlistToolbar({
  browser,
  search = false,
  notes,
  idPrefix,
}: {
  browser: WatchlistBrowser;
  // Champ de recherche (« Ma liste » uniquement).
  search?: boolean;
  // Interrupteur « Afficher les notes » (« Ma liste » uniquement).
  notes?: { show: boolean; onChange: (show: boolean) => void };
  idPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const { facets, visible, total, filtersActive } = browser;
  const panelId = `${idPrefix}-panel`;

  return (
    <div className="toolbar">
      <div className="toolbar-top">
        <span className="muted toolbar-count" aria-live="polite">
          {filtersActive ? `${visible.length} sur ${total} titres` : `${total} ${total > 1 ? "titres" : "titre"}`}
        </span>
        {filtersActive && (
          <button type="button" className="link-button toolbar-reset" onClick={browser.reset}>
            Réinitialiser les filtres
          </button>
        )}
        <button
          type="button"
          className="toolbar-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <FunnelIcon aria-hidden="true" />
          Filtres et tri{filtersActive ? " •" : ""}
        </button>
      </div>
      <div id={panelId} className="toolbar-panel" data-open={open}>
        {search && (
          <label className="search-field toolbar-search">
            <MagnifyingGlassIcon aria-hidden="true" />
            <input
              type="search"
              placeholder="Rechercher dans ma liste"
              aria-label="Rechercher dans ma liste"
              value={browser.query}
              onChange={(event) => browser.setQuery(event.target.value)}
            />
          </label>
        )}
        <div className="toolbar-fields">
          <div className="toolbar-sort">
            <label>
              <span className="filter-label">Trier par</span>
              <select value={browser.sort} onChange={(event) => browser.setSort(event.target.value as typeof browser.sort)}>
                {Object.entries(WATCHLIST_SORTS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="toolbar-reverse"
              aria-label="Inverser l'ordre"
              title="Inverser l'ordre"
              aria-pressed={browser.reverse}
              onClick={browser.toggleReverse}
            >
              <ArrowsUpDownIcon aria-hidden="true" />
            </button>
          </div>
          <label>
            <span className="filter-label">Type</span>
            <select value={browser.type} onChange={(event) => browser.setType(event.target.value as typeof browser.type)}>
              <option value="">Tous</option>
              <option value="MOVIE">Films</option>
              <option value="SHOW">Séries</option>
            </select>
          </label>
          <label>
            <span className="filter-label">Réalisateur</span>
            <select value={browser.director} onChange={(event) => browser.setDirector(event.target.value)}>
              <option value="">Tous</option>
              {facets.directors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">Genre</span>
            <select value={browser.genre} onChange={(event) => browser.setGenre(event.target.value)}>
              <option value="">Tous</option>
              {facets.genres.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="toolbar-checks">
          <label>
            <input
              type="checkbox"
              checked={browser.atHomeOnly}
              onChange={(event) => browser.setAtHomeOnly(event.target.checked)}
            />
            Disponible chez moi
          </label>
          {notes && (
            <label>
              <input type="checkbox" checked={notes.show} onChange={(event) => notes.onChange(event.target.checked)} />
              Afficher les notes
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
