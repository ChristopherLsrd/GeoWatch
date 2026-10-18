"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";
import type { BiographySource, FilmographyCard, Person, PersonRole } from "@/domain/Person";
import { apiFetch } from "./apiFetch";
import { formatLifeDates, yearWithRuntime } from "./format";
import { TitleCard } from "./TitleCard";

// Valeur du paramètre d'URL `role` pour chaque onglet.
export const ROLE_PARAMS: Record<PersonRole, string> = {
  DIRECTOR: "realisation",
  ACTOR: "interpretation",
  OTHER: "autres",
};

const ROLE_LABELS: Record<PersonRole, string> = {
  DIRECTOR: "Réalisation",
  ACTOR: "Interprétation",
  OTHER: "Autres",
};

const TAB_ORDER: PersonRole[] = ["DIRECTOR", "ACTOR", "OTHER"];

const SOURCE_LABELS: Record<BiographySource, string> = {
  justwatch: "JustWatch",
  tmdb: "TMDB",
  wikipedia: "Wikipédia",
};

const BIOGRAPHY_LIMIT = 300;

type Filmography = Record<PersonRole, FilmographyCard[]>;

type State =
  | { kind: "loading" }
  | { kind: "ready"; person: Person; filmography: Filmography }
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "error" };

export function PersonView({ id, initialRole }: { id: string; initialRole?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    (async () => {
      try {
        const response = await apiFetch(`/api/people/${encodeURIComponent(id)}`, controller.signal);
        if (response.status === 404) {
          if (!controller.signal.aborted) setState({ kind: "not_found" });
          return;
        }
        if (response.status === 503) {
          if (!controller.signal.aborted) setState({ kind: "unavailable" });
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { person: Person; filmography: Filmography };
        if (!controller.signal.aborted) setState({ kind: "ready", person: body.person, filmography: body.filmography });
      } catch {
        if (!controller.signal.aborted) setState({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Retour à la page précédente ; sans historique (page ouverte directement), retour à l'accueil.
  function goBack() {
    if (window.history.length <= 1) router.push("/");
    else router.back();
  }

  return (
    <div className="title-page">
      <button type="button" className="back-link ghost" onClick={goBack}>
        <ArrowLeftIcon aria-hidden="true" />
        Retour
      </button>

      {state.kind === "loading" && <p className="muted">Chargement…</p>}
      {state.kind === "not_found" && (
        <p role="alert">
          Personne introuvable. <Link href="/">Retour à l&apos;accueil</Link>
        </p>
      )}
      {(state.kind === "unavailable" || state.kind === "error") && (
        <div className="person-error">
          <p role="alert" className="error">
            {state.kind === "unavailable"
              ? "JustWatch ne répond pas pour le moment."
              : "Impossible de charger cette personne."}
          </p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <PersonHeader person={state.person} />
          <Filmography filmography={state.filmography} initialRole={initialRole} />
        </>
      )}
    </div>
  );
}

function PersonHeader({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const life = formatLifeDates(person.birthDate, person.deathDate, new Date());
  const biography = person.biography?.trim() ?? "";
  const long = biography.length > BIOGRAPHY_LIMIT;
  const text = long && !open ? `${biography.slice(0, BIOGRAPHY_LIMIT).trimEnd()}…` : biography;
  return (
    <header className="person-head">
      {person.photoUrl ? (
        <img className="person-photo" src={person.photoUrl} alt="" />
      ) : (
        <div className="person-photo person-photo-empty">
          <UserIcon aria-hidden="true" />
        </div>
      )}
      <div className="person-info">
        <h1>{person.name}</h1>
        {life && <p className="title-meta">{life}</p>}
        {biography && (
          <div className="synopsis">
            <p>{text}</p>
            {long && (
              <button type="button" className="ghost link-accent" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? "Réduire" : "Lire la suite"}
              </button>
            )}
          </div>
        )}
        {person.biographySource && person.sourceUrl && (
          <p className="muted">
            Source :{" "}
            <a href={person.sourceUrl} target="_blank" rel="noopener noreferrer">
              {SOURCE_LABELS[person.biographySource]}
            </a>
          </p>
        )}
      </div>
    </header>
  );
}

function Filmography({ filmography, initialRole }: { filmography: Filmography; initialRole?: string }) {
  const tabs = TAB_ORDER.filter((role) => filmography[role].length > 0);
  const requested = TAB_ORDER.find((role) => ROLE_PARAMS[role] === initialRole);
  const [selected, setSelected] = useState<PersonRole | undefined>(
    requested && filmography[requested].length > 0 ? requested : tabs[0],
  );

  if (tabs.length === 0 || !selected) return <p className="muted">Aucun titre.</p>;

  function select(role: PersonRole) {
    setSelected(role);
    window.history.replaceState(null, "", `?role=${ROLE_PARAMS[role]}`);
  }

  return (
    <section>
      <div className="person-tabs" role="tablist">
        {tabs.map((role) => (
          <button
            key={role}
            type="button"
            role="tab"
            id={`person-tab-${role}`}
            aria-selected={role === selected}
            aria-controls="person-panel"
            className="ghost person-tab"
            onClick={() => select(role)}
          >
            {ROLE_LABELS[role]} ({filmography[role].length})
          </button>
        ))}
      </div>
      <div id="person-panel" role="tabpanel" aria-labelledby={`person-tab-${selected}`}>
        <ul className="card-grid">
          {filmography[selected].map((card) => (
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
      </div>
    </section>
  );
}
