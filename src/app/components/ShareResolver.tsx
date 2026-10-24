"use client";

// Écran du partage vers GeoWatch : « Recherche du titre… », puis la fiche (sans repasser par cet écran
// au retour arrière), le choix entre plusieurs candidats, ou la recherche de l'accueil.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ShareResolution } from "@/application/share/ResolveSharedLink";
import type { Title } from "@/domain/Title";
import { apiFetch } from "./apiFetch";

type State = { kind: "loading" } | { kind: "candidates"; candidates: Title[] } | { kind: "error" };

export function ShareResolver({ title, text, url }: { title: string; text: string; url: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  // Un seul appel en cours : relancer ou quitter l'écran annule le précédent.
  const controller = useRef<AbortController | null>(null);

  const resolve = useCallback(
    async () => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const signal = current.signal;
      setState({ kind: "loading" });
      try {
        const response = await apiFetch("/api/share/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, text, url }),
          signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const resolution = (await response.json()) as ShareResolution;
        if (signal.aborted) return;
        if (resolution.kind === "title") router.replace(`/titre/${encodeURIComponent(resolution.id)}`);
        else if (resolution.kind === "candidates") setState({ kind: "candidates", candidates: resolution.candidates });
        else router.replace(resolution.query ? `/?q=${encodeURIComponent(resolution.query)}` : "/");
      } catch {
        if (!signal.aborted) setState({ kind: "error" });
      }
    },
    [title, text, url, router],
  );

  useEffect(() => {
    void resolve();
    return () => controller.current?.abort();
  }, [resolve]);

  if (state.kind === "loading") {
    return (
      <main className="container share-screen">
        <p className="share-status" role="status" aria-live="polite">
          Recherche du titre…
        </p>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="container share-screen">
        <p role="alert" className="error">
          Impossible de retrouver le titre.
        </p>
        <div className="share-actions">
          <button type="button" onClick={() => void resolve()}>
            Réessayer
          </button>
          <Link href="/">Chercher sur l&apos;accueil</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container share-screen">
      <h1>Plusieurs titres correspondent</h1>
      <ul className="candidate-grid">
        {state.candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              className="candidate"
              onClick={() => router.replace(`/titre/${encodeURIComponent(candidate.id)}`)}
            >
              {candidate.posterUrl ? (
                <img className="poster" src={candidate.posterUrl} alt={`Affiche de ${candidate.name}`} loading="lazy" />
              ) : (
                <div className="poster" />
              )}
              <span>
                <strong>{candidate.name}</strong>
                <br />
                <span className="muted">
                  {candidate.type === "SHOW" ? "Série" : "Film"} · {candidate.year ?? "année inconnue"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/">Aucun de ces titres : chercher sur l&apos;accueil</Link>
      </p>
    </main>
  );
}
