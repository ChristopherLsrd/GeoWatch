"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Title } from "@/domain/Title";
import { ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "./apiFetch";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; titles: Title[] }
  | { kind: "error"; message: string };

type HistoryEntry = { query: string; searchedAt: string };

const DEBOUNCE_MS = 300;
const HISTORY_VISIBLE = 10;
const HISTORY_MAX = 50;

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  const lastSearched = useRef("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Chargement de l'historique (erreurs ignorées : il est facultatif).
  useEffect(() => {
    const loader = new AbortController();
    apiFetch("/api/history", loader.signal)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { entries?: HistoryEntry[] } | null) => {
        if (body?.entries) setHistory(body.entries);
      })
      .catch(() => {});
    return () => loader.abort();
  }, []);

  // Enregistre une recherche validée : sans attente ni erreur visible, et la liste locale suit.
  function record(text: string, keepalive = false) {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    apiFetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
      keepalive,
    }).catch(() => {});
    setHistory((previous) =>
      [
        { query: trimmed, searchedAt: new Date().toISOString() },
        ...previous.filter((entry) => entry.query.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, HISTORY_MAX),
    );
  }

  async function clearHistory() {
    if (!window.confirm("Effacer tout l'historique des recherches ?")) return;
    try {
      const response = await apiFetch("/api/history", { method: "DELETE" });
      if (response.ok) setHistory([]);
    } catch {
      // Silencieux : l'historique reste affiché.
    }
  }

  function pickHistory(text: string) {
    setQuery(text);
    void search(text);
    record(text);
  }

  async function search(text: string) {
    controller.current?.abort();
    const trimmed = text.trim();
    lastSearched.current = trimmed.length < 2 ? "" : trimmed;
    if (trimmed.length < 2) {
      setState({ kind: "idle" });
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setState({ kind: "loading" });
    try {
      const response = await apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}`, current.signal);
      if (response.status === 503) {
        setState({ kind: "error", message: "JustWatch est momentanément indisponible." });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { titles: Title[] };
      setState({ kind: "done", titles: body.titles });
    } catch (error) {
      if (current.signal.aborted) return;
      setState({ kind: "error", message: "La recherche a échoué, réessayez." });
    }
  }

  // Recherche avec anti-rebond pendant la frappe.
  useEffect(() => {
    // Déjà lancée immédiatement (Entrée, historique) : pas de doublon.
    if (query.trim() === lastSearched.current) return;
    const timer = setTimeout(() => void search(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => controller.current?.abort(), []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void search(query);
    record(query);
  }

  return (
    <section className="search-box">
      <form className="search-form" onSubmit={onSubmit} role="search">
        <label className="search-field">
          <MagnifyingGlassIcon aria-hidden="true" />
          <input
            type="search"
            aria-label="Rechercher un film ou une série"
            placeholder="Rechercher un film ou une série…"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button type="submit" className="primary">
          Rechercher
        </button>
      </form>

      {query.trim() === "" && history.length > 0 && (
        <div className="history">
          <div className="history-head">
            <h2>
              <ClockIcon aria-hidden="true" />
              Recherches récentes
            </h2>
            <button type="button" className="ghost" onClick={() => void clearHistory()}>
              Tout effacer
            </button>
          </div>
          <ul className="history-list">
            {(showAll ? history : history.slice(0, HISTORY_VISIBLE)).map((entry) => (
              <li key={entry.query.toLowerCase()}>
                <button type="button" className="history-item" onClick={() => pickHistory(entry.query)}>
                  <MagnifyingGlassIcon aria-hidden="true" />
                  <span>{entry.query}</span>
                </button>
              </li>
            ))}
          </ul>
          {history.length > HISTORY_VISIBLE && (
            <button type="button" className="link-button" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "Réduire" : "Tout afficher"}
            </button>
          )}
        </div>
      )}

      {state.kind === "loading" && <p className="muted">Recherche en cours…</p>}
      {state.kind === "error" && (
        <p role="alert" className="error">
          {state.message}
        </p>
      )}
      {state.kind === "done" && state.titles.length === 0 && <p className="muted">Aucun résultat.</p>}
      {state.kind === "done" && state.titles.length > 0 && (
        <ul className="results">
          {state.titles.map((title) => (
            <li key={title.id}>
              <Link href={`/titre/${encodeURIComponent(title.id)}`} className="result" onClick={() => record(query, true)}>
                {title.posterUrl ? (
                  <img className="poster" src={title.posterUrl} alt="" loading="lazy" />
                ) : (
                  <div className="poster" />
                )}
                <div>
                  <div className="result-title">{title.name}</div>
                  <div className="muted">
                    {title.year ?? "année inconnue"} · {title.type === "MOVIE" ? "Film" : "Série"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
