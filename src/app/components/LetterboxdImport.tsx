"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { LetterboxdCsvError, parseLetterboxdCsv, type LetterboxdEntry } from "@/application/import/parseLetterboxdCsv";
import type { ImportResult } from "@/application/import/ImportLetterboxd";
import { apiFetch } from "./apiFetch";

// Même valeur que MAX_BATCH côté serveur (copiée pour ne pas embarquer de code serveur).
const BATCH_SIZE = 5;
// Pause entre deux lots (le serveur pause déjà 1 s entre les films d'un lot).
const BATCH_PAUSE_MS = 1000;

type Stopped = "user" | "catalog" | "network" | "error" | null;
type Ambiguous = Extract<ImportResult, { status: "ambiguous" }>;

const keyOf = (entry: LetterboxdEntry) => entry.letterboxdUri ?? entry.name;
const label = (entry: LetterboxdEntry) => (entry.year ? `${entry.name} (${entry.year})` : entry.name);
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// Carte d'un film à valider : l'utilisateur choisit parmi les candidats ou écarte le film.
function AmbiguousCard({
  result,
  onResolved,
  onDismiss,
}: {
  result: Ambiguous;
  onResolved: () => void;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(titleId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/api/watchlist/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolve: { titleId, addedAt: result.entry.addedAt } }),
      });
      if (!response.ok) {
        setError(
          response.status === 503 ? "JustWatch est momentanément indisponible, réessayez." : "L'ajout a échoué, réessayez.",
        );
        return;
      }
      onResolved();
    } catch {
      setError("L'ajout a échoué, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="import-card">
      <p>
        <strong>{label(result.entry)}</strong> <span className="muted">sur Letterboxd : quel est le bon film ?</span>
      </p>
      <ul className="candidate-grid">
        {result.candidates.map((title) => (
          <li key={title.id}>
            <button type="button" className="candidate" disabled={busy} onClick={() => void pick(title.id)}>
              {title.posterUrl ? (
                <img className="poster" src={title.posterUrl} alt={`Affiche de ${title.name}`} loading="lazy" />
              ) : (
                <div className="poster" />
              )}
              <span>
                <strong>{title.name}</strong>
                <br />
                <span className="muted">{title.year ?? "année inconnue"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div>
        <button type="button" className="ghost" disabled={busy} onClick={onDismiss}>
          Aucun
        </button>
      </div>
    </li>
  );
}

export function LetterboxdImport() {
  const [entries, setEntries] = useState<LetterboxdEntry[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<LetterboxdEntry[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<Stopped>(null);
  const [resolved, setResolved] = useState<Record<string, "added" | "dismissed">>({});
  const [over, setOver] = useState(false);
  const stopRef = useRef(false);
  const runningRef = useRef(false);

  // Quitter la page arrête la boucle : plus aucun lot n'est envoyé (les mises à jour d'état après démontage sont sans effet).
  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  async function readFile(file: File | undefined) {
    if (!file || started) return;
    setFileError(null);
    setEntries(null);
    try {
      const parsed = parseLetterboxdCsv(await file.text());
      setEntries(parsed.entries);
      setSkipped(parsed.skipped);
    } catch (error) {
      setFileError(error instanceof LetterboxdCsvError ? error.message : "Lecture du fichier impossible.");
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    void readFile(event.dataTransfer.files[0]);
  }

  async function run(start: LetterboxdEntry[]) {
    // Garde contre un double clic avant le re-rendu : une seule boucle à la fois.
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await runLoop(start);
    } finally {
      runningRef.current = false;
    }
  }

  async function runLoop(start: LetterboxdEntry[]) {
    stopRef.current = false;
    setRunning(true);
    setStopped(null);
    let pending = start;
    let reason: Stopped = null;
    let firstBatch = true;
    while (pending.length > 0 && !stopRef.current) {
      // Le serveur ne fait de pause qu'entre les films d'un lot : on la prolonge entre les lots.
      if (!firstBatch) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
        if (stopRef.current) break;
      }
      firstBatch = false;
      const batch = pending.slice(0, BATCH_SIZE);
      let response: Response;
      try {
        response = await apiFetch("/api/watchlist/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: batch }),
        });
      } catch {
        reason = "network";
        break;
      }
      if (!response.ok) {
        reason = response.status === 503 ? "catalog" : "error";
        break;
      }
      try {
        const body = (await response.json()) as { results: ImportResult[]; remaining: LetterboxdEntry[] };
        setResults((previous) => [...previous, ...body.results]);
        pending = [...body.remaining, ...pending.slice(batch.length)];
        setQueue(pending);
        if (body.remaining.length > 0) {
          reason = "catalog";
          break;
        }
      } catch {
        reason = "network";
        break;
      }
    }
    if (!reason && stopRef.current && pending.length > 0) reason = "user";
    setStopped(reason);
    setRunning(false);
  }

  function start() {
    if (!entries || entries.length === 0) return;
    setStarted(true);
    setResults([]);
    setResolved({});
    setQueue(entries);
    void run(entries);
  }

  const total = entries?.length ?? 0;
  const done = results.length;
  const count = (status: ImportResult["status"]) => results.filter((r) => r.status === status).length;
  const ambiguous = results.filter((r): r is Ambiguous => r.status === "ambiguous");
  const toValidate = ambiguous.filter((r) => !resolved[keyOf(r.entry)]);
  const addedByHand = Object.values(resolved).filter((v) => v === "added").length;
  const added = count("added") + addedByHand;
  const notFound = results.filter((r) => r.status === "notFound");
  const finished = started && queue.length === 0 && !running;

  return (
    <div className="import-flow">
      <section className="import-card">
        <h2>1. Le fichier</h2>
        <ol className="import-steps">
          <li>Sur Letterboxd : Settings → Import &amp; Export → Export your data.</li>
          <li>Décompressez le ZIP téléchargé.</li>
          <li>
            Choisissez le fichier <span className="mono">watchlist.csv</span>.
          </li>
        </ol>
        <label
          className={`dropzone${over ? " is-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <ArrowUpTrayIcon aria-hidden="true" />
          <span>Déposez watchlist.csv ici ou touchez pour choisir le fichier</span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={started}
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {fileError && (
          <p role="alert" className="error">
            {fileError}
          </p>
        )}
        {entries && (
          <div className="import-actions">
            <p>
              {plural(total, "film trouvé", "films trouvés")} · {plural(skipped, "ligne ignorée", "lignes ignorées")}
            </p>
            {!started && (
              <button type="button" className="primary" disabled={total === 0} onClick={start}>
                Lancer l&apos;import
              </button>
            )}
          </div>
        )}
      </section>

      {started && (
        <section className="import-card" aria-live="polite">
          <h2>2. La progression</h2>
          <p>
            {done} / {total} films traités
          </p>
          <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <ul className="import-counters">
            <li>
              Ajoutés <strong>{added}</strong>
            </li>
            <li>
              Déjà dans ma liste <strong>{count("alreadyInList")}</strong>
            </li>
            <li>
              À valider <strong>{toValidate.length}</strong>
            </li>
            <li>
              Introuvables <strong>{notFound.length}</strong>
            </li>
          </ul>
          {running && (
            <div className="import-actions">
              <button type="button" onClick={() => (stopRef.current = true)}>
                Arrêter
              </button>
            </div>
          )}
          {!running && stopped === "error" && queue.length > 0 && (
            <p role="alert" className="error">
              L&apos;import a échoué. {plural(queue.length, "film non traité", "films non traités")}.
            </p>
          )}
          {!running && stopped && stopped !== "error" && queue.length > 0 && (
            <div className="import-actions">
              <p>
                {plural(queue.length, "film non traité", "films non traités")}
                {stopped === "catalog" && " · JustWatch limite les requêtes, réessayez dans quelques minutes"}
                {stopped === "network" && " · la connexion a échoué"}
              </p>
              <button type="button" className="primary" onClick={() => void run(queue)}>
                Reprendre
              </button>
            </div>
          )}
        </section>
      )}

      {toValidate.length > 0 && (
        <section className="import-card">
          <h2>3. À valider</h2>
          <ul className="results">
            {toValidate.map((r) => (
              <AmbiguousCard
                key={keyOf(r.entry)}
                result={r}
                onResolved={() => setResolved((previous) => ({ ...previous, [keyOf(r.entry)]: "added" }))}
                onDismiss={() => setResolved((previous) => ({ ...previous, [keyOf(r.entry)]: "dismissed" }))}
              />
            ))}
          </ul>
        </section>
      )}

      {finished && (
        <section className="import-card">
          <h2>Récapitulatif</h2>
          <p>
            {plural(added, "film ajouté", "films ajoutés")} à ma liste · <Link href="/liste">Voir ma liste</Link>
          </p>
          {notFound.length > 0 && (
            <>
              <p className="muted">Introuvables sur JustWatch :</p>
              <ul className="import-missing">
                {notFound.map((r) => (
                  <li key={keyOf(r.entry)}>
                    <strong>{label(r.entry)}</strong>
                    <Link href={`/?q=${encodeURIComponent(r.entry.name)}`}>Chercher dans GeoWatch</Link>
                    {r.entry.letterboxdUri && (
                      <a href={r.entry.letterboxdUri} target="_blank" rel="noopener noreferrer">
                        Voir sur Letterboxd
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
