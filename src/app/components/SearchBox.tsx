"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Title } from "@/domain/Title";
import { apiFetch } from "./apiFetch";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; titles: Title[] }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 300;

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);

  async function search(text: string) {
    controller.current?.abort();
    const trimmed = text.trim();
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
    const timer = setTimeout(() => void search(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => controller.current?.abort(), []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void search(query);
  }

  return (
    <section>
      <form className="search-form" onSubmit={onSubmit} role="search">
        <input
          type="search"
          aria-label="Rechercher un film ou une série"
          placeholder="Rechercher un film ou une série…"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="primary">
          Rechercher
        </button>
      </form>

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
              <Link href={`/titre/${encodeURIComponent(title.id)}`} className="result">
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
