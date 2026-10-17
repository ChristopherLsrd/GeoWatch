"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeftIcon, ArrowPathIcon, CheckCircleIcon, HomeIcon } from "@heroicons/react/24/outline";
import { availableAtHome } from "@/application/catalog/availableAtHome";
import { countryBatches } from "@/application/catalog/countryBatches";
import { countryFlag, countryName } from "@/domain/Country";
import { ORIGINAL_LANGUAGE } from "@/domain/Preferences";
import { languageName } from "@/domain/Language";
import type { Offer } from "@/domain/Offer";
import type { Subscription } from "@/domain/Subscription";
import type { TitleDetails } from "@/domain/TitleDetails";
import { apiFetch } from "./apiFetch";
import { formatRuntime, formatScore } from "./format";
import { OfferResults } from "./OfferResults";
import { useFitPosterWidth } from "./useFitPosterWidth";
import { WatchlistButton } from "./WatchlistButton";

const BATCHES = countryBatches();
const TOTAL_COUNTRIES = BATCHES.reduce((sum, batch) => sum + batch.length, 0);

type TitleState =
  | { kind: "loading" }
  | { kind: "ready"; title: TitleDetails }
  | { kind: "not_found" }
  | { kind: "error" };

// « loading » : un lot est en cours ; « stopped » : arrêt après une erreur ; « done » : tous les lots sont faits.
type LoadStatus = "loading" | "stopped" | "done";

const PARIS = "Europe/Paris";

// « aujourd'hui à 08:12 », ou « le 17/10 à 08:12 » si le jour (heure de Paris) n'est plus aujourd'hui.
function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" });
  const day = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: PARIS });
  if (day(date) === day(new Date())) return `aujourd'hui à ${time}`;
  const shortDay = date.toLocaleDateString("fr-FR", { timeZone: PARIS, day: "2-digit", month: "2-digit" });
  return `le ${shortDay} à ${time}`;
}

// 2900000 -> « 2,9 M votes » ; 12400 -> « 12 k votes ».
function formatVotes(votes: number): string {
  const compact = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
  if (votes >= 1_000_000) return `${compact(votes / 1_000_000)} M votes`;
  if (votes >= 1_000) return `${compact(votes / 1_000)} k votes`;
  return `${votes} ${votes > 1 ? "votes" : "vote"}`;
}

function ratingPills(title: TitleDetails) {
  const kind = title.type === "MOVIE" ? "movie" : "tv";
  const imdbHref = title.imdbId ? `https://www.imdb.com/title/${title.imdbId}/` : null;
  const tmdbHref = title.tmdbId ? `https://www.themoviedb.org/${kind}/${title.tmdbId}` : null;
  return [
    { label: "IMDb", score: title.imdbScore, votes: title.imdbVotes, href: imdbHref },
    { label: "TMDB", score: title.tmdbScore, votes: null, href: tmdbHref },
  ];
}

export function TitleView({ id }: { id: string }) {
  const [titleState, setTitleState] = useState<TitleState>({ kind: "loading" });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [checkedAt, setCheckedAt] = useState<Record<string, string>>({});
  const [nextBatch, setNextBatch] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  // undefined tant que non chargées ; null si aucune préférence ou échec.
  const [prefs, setPrefs] = useState<{ audio: string | null; subtitles: string | null } | undefined>();

  const nextBatchRef = useRef(0);
  const refreshRef = useRef(false);
  const controller = useRef<AbortController | null>(null);

  // Interroge les lots l'un après l'autre à partir de `start`, en affichant les résultats au fil de l'eau.
  // Avec `refresh`, le cache serveur est ignoré ; le mode est mémorisé pour que « Réessayer » le conserve.
  const loadBatches = useCallback(
    async (start: number, refresh: boolean) => {
      refreshRef.current = refresh;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setStatus("loading");

      for (let i = start; i < BATCHES.length; i++) {
        try {
          const response = await apiFetch(
            `/api/titles/${encodeURIComponent(id)}/availability?countries=${BATCHES[i].join(",")}${refresh ? "&refresh=1" : ""}`,
            current.signal,
          );
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as {
            offers: Record<string, Offer[]>;
            checkedAt: Record<string, string>;
          };
          if (current.signal.aborted) return;
          setOffers((previous) => [...previous, ...Object.values(body.offers).flat()]);
          setCheckedAt((previous) => ({ ...previous, ...body.checkedAt }));
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
    setCheckedAt({});
    setNextBatch(0);
    nextBatchRef.current = 0;

    (async () => {
      try {
        const response = await apiFetch(`/api/titles/${encodeURIComponent(id)}`, current.signal);
        if (response.status === 404) return setTitleState({ kind: "not_found" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { title: TitleDetails };
        if (!current.signal.aborted) setTitleState({ kind: "ready", title: body.title });
      } catch {
        if (!current.signal.aborted) setTitleState({ kind: "error" });
      }
    })();

    void loadBatches(0, false);
    return () => {
      current.abort();
      controller.current?.abort();
    };
  }, [id, loadBatches]);

  // Abonnements chargés en parallèle ; en cas d'échec on continue sans badge.
  useEffect(() => {
    const current = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/subscriptions", current.signal);
        if (!response.ok) return;
        const body = (await response.json()) as { subscriptions: Subscription[] };
        if (!current.signal.aborted) setSubscriptions(body.subscriptions);
      } catch {
        // pas de badge
      }
    })();
    return () => current.abort();
  }, []);

  // Préférences de langue chargées en parallèle ; en cas d'échec, pas de préférence.
  useEffect(() => {
    const current = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/preferences", current.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as {
          preferences: { audioLanguage: string | null; subtitleLanguage: string | null };
        };
        if (!current.signal.aborted) {
          setPrefs({
            audio: body.preferences.audioLanguage || null,
            subtitles: body.preferences.subtitleLanguage || null,
          });
        }
      } catch {
        if (!current.signal.aborted) setPrefs({ audio: null, subtitles: null });
      }
    })();
    return () => current.abort();
  }, []);

  // « Version originale » : résolue avec la langue d'origine du titre. Rien n'est transmis à OfferResults
  // (undefined) tant que les préférences, et le titre si nécessaire, ne sont pas connus.
  const wantsOriginal = prefs?.audio === ORIGINAL_LANGUAGE;
  const titleSettled = titleState.kind !== "loading";
  const originalLanguage = titleState.kind === "ready" ? titleState.title.originalLanguage : null;
  const prefsReady = prefs !== undefined && (!wantsOriginal || titleSettled);
  const defaultAudio = !prefsReady ? undefined : wantsOriginal ? originalLanguage : prefs.audio;
  const defaultSubtitles = prefsReady ? prefs.subtitles : undefined;

  // Calculé sur toutes les offres reçues, pas sur les offres filtrées.
  const atHome = useMemo(() => availableAtHome(offers, subscriptions), [offers, subscriptions]);
  const subscribedPlatformIds = useMemo(
    () => [...new Set(subscriptions.map((s) => s.platform.id))],
    [subscriptions],
  );

  const checkedCountries = BATCHES.slice(0, nextBatch).reduce((sum, batch) => sum + batch.length, 0);
  const missingCountries = TOTAL_COUNTRIES - checkedCountries;

  // Date de vérification la plus ancienne parmi les pays reçus.
  const oldestCheck = Object.values(checkedAt).sort()[0];

  // Repart de zéro en ignorant le cache serveur.
  function refresh() {
    setOffers([]);
    setCheckedAt({});
    setNextBatch(0);
    nextBatchRef.current = 0;
    void loadBatches(0, true);
  }

  return (
    <div className="title-page">
      <Link href="/" className="back-link">
        <ArrowLeftIcon aria-hidden="true" />
        Retour à la recherche
      </Link>

      {titleState.kind === "loading" && <p className="muted">Chargement du titre…</p>}
      {titleState.kind === "not_found" && <p role="alert">Titre introuvable.</p>}
      {titleState.kind === "error" && (
        <p role="alert" className="error">
          Impossible de charger le titre.
        </p>
      )}
      {titleState.kind === "ready" && <TitleHeader title={titleState.title} atHome={atHome} />}

      {titleState.kind !== "not_found" && (
        <>
          <div className={status === "stopped" ? "progress warn" : "progress"} aria-live="polite">
            <span className="progress-text">
              {status === "done" && <CheckCircleIcon aria-hidden="true" />}
              {status === "loading" && `${checkedCountries} / ${TOTAL_COUNTRIES} pays vérifiés…`}
              {status === "done" && `${TOTAL_COUNTRIES} / ${TOTAL_COUNTRIES} pays vérifiés`}
              {status === "stopped" &&
                `${checkedCountries} / ${TOTAL_COUNTRIES} pays vérifiés · ${missingCountries} pays non vérifiés (JustWatch ne répond pas pour le moment)`}
            </span>
            {oldestCheck && <span className="progress-note">Données vérifiées {formatCheckedAt(oldestCheck)}</span>}
            {status === "stopped" && (
              <button type="button" className="progress-retry" onClick={() => void loadBatches(nextBatchRef.current, refreshRef.current)}>
                Réessayer
              </button>
            )}
            <button type="button" className="progress-refresh" aria-label="Actualiser" onClick={refresh} disabled={status === "loading"}>
              <ArrowPathIcon aria-hidden="true" />
              <span className="progress-refresh-label">Actualiser</span>
            </button>
            <div className="progress-bar" aria-hidden="true">
              <div style={{ width: `${(checkedCountries / TOTAL_COUNTRIES) * 100}%` }} />
            </div>
          </div>

          {prefsReady && wantsOriginal && !originalLanguage && (
            <p className="muted">Langue originale inconnue : pas de filtre VO.</p>
          )}
          <OfferResults
            offers={offers}
            complete={status === "done"}
            subscribedPlatformIds={subscribedPlatformIds}
            defaultAudioLanguage={defaultAudio}
            defaultSubtitleLanguage={defaultSubtitles}
            defaultAudioLabel={wantsOriginal ? "VO" : undefined}
          />
        </>
      )}
    </div>
  );
}

const SYNOPSIS_LIMIT = 300;
const CAST_VISIBLE = 5;

function TitleHeader({ title, atHome }: { title: TitleDetails; atHome: Subscription[] }) {
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const { infoRef, posterWidth } = useFitPosterWidth();
  const pills = ratingPills(title);
  const meta = [
    title.year ?? "année inconnue",
    title.type === "MOVIE" ? "Film" : "Série",
    ...(title.runtime ? [formatRuntime(title.runtime)] : []),
    ...(title.genres.length > 0 ? [title.genres.join(", ")] : []),
    ...(title.originalLanguage ? [`VO : ${languageName(title.originalLanguage)}`] : []),
  ];
  const synopsis = title.synopsis?.trim() ?? "";
  const longSynopsis = synopsis.length > SYNOPSIS_LIMIT;
  const synopsisText =
    longSynopsis && !synopsisOpen ? `${synopsis.slice(0, SYNOPSIS_LIMIT).trimEnd()}…` : synopsis;
  const cast = castOpen ? title.cast : title.cast.slice(0, CAST_VISIBLE);
  return (
    <header
      className="title-head"
      style={posterWidth ? ({ "--pw": `${posterWidth}px` } as CSSProperties) : undefined}
    >
      {title.posterUrl ? (
        <img className="title-poster" src={title.posterUrl} alt={`Affiche de ${title.name}`} />
      ) : (
        <div className="title-poster" />
      )}
      <div className="title-info" ref={infoRef}>
        <div className="title-top">
          <h1>{title.name}</h1>
          {title.originalTitle && title.originalTitle !== title.name && (
            <p className="original-title">{title.originalTitle}</p>
          )}
          <p className="title-meta">
            {meta.map((item, index) => (
              <Fragment key={index}>
                {index > 0 && (
                  <span className="title-dot" aria-hidden="true">
                    ·
                  </span>
                )}
                <span>{item}</span>
              </Fragment>
            ))}
          </p>
          <div className="ratings">
            {pills.map((pill) => {
              const content = (
                <>
                  <strong>{pill.label}</strong>
                  {pill.score != null && <span className="rating-score">{formatScore(pill.score)}</span>}
                  {pill.votes != null && <span className="rating-votes">{formatVotes(pill.votes)}</span>}
                </>
              );
              if (pill.score == null && !pill.href) return null;
              return pill.href ? (
                <a key={pill.label} className="rating" href={pill.href} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              ) : (
                <span key={pill.label} className="rating">
                  {content}
                </span>
              );
            })}
          </div>
        </div>
        {synopsis && (
          <div className="synopsis">
            <p>{synopsisText}</p>
            {longSynopsis && (
              <button
                type="button"
                className="ghost link-accent"
                aria-expanded={synopsisOpen}
                onClick={() => setSynopsisOpen(!synopsisOpen)}
              >
                {synopsisOpen ? "Réduire" : "Lire la suite"}
              </button>
            )}
          </div>
        )}
        {(title.directors.length > 0 || title.cast.length > 0) && (
          <dl className="credits">
            {title.directors.length > 0 && (
              <>
                <dt>{title.type === "MOVIE" ? "Réalisation" : "Création"}</dt>
                <dd>{title.directors.join(", ")}</dd>
              </>
            )}
            {title.cast.length > 0 && (
              <>
                <dt>Distribution</dt>
                <dd>
                  {cast.map((member, index) => (
                    <Fragment key={`${member.name}-${index}`}>
                      {index > 0 && ", "}
                      {member.name}
                      {member.character && <span className="muted"> · {member.character}</span>}
                    </Fragment>
                  ))}
                  {title.cast.length > CAST_VISIBLE && (
                    <button
                      type="button"
                      className="ghost link-accent credits-more"
                      aria-expanded={castOpen}
                      onClick={() => setCastOpen(!castOpen)}
                    >
                      {castOpen ? "Réduire" : "Voir tout"}
                    </button>
                  )}
                </dd>
              </>
            )}
          </dl>
        )}
        <div className="home-block">
          {atHome.length > 0 && (
            <div className="at-home" role="status">
              <HomeIcon aria-hidden="true" />
              <div>
                <strong>Disponible chez moi</strong>
                <span>
                  {atHome.map((s, index) => (
                    <Fragment key={`${s.platform.id}-${s.country}`}>
                      {index > 0 && " ; "}
                      {s.platform.name} · <span className="flag" aria-hidden="true">{countryFlag(s.country)}</span>{" "}
                      {countryName(s.country)}
                    </Fragment>
                  ))}
                </span>
              </div>
            </div>
          )}
          <WatchlistButton titleId={title.id} />
        </div>
      </div>
    </header>
  );
}
