"use client";

import { useEffect, useState } from "react";
import {
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import { PREFERENCE_LANGUAGES } from "@/config/languages";
import { languageName } from "@/domain/Language";
import { ORIGINAL_LANGUAGE } from "@/domain/Preferences";
import { DEFAULT_PRICE_THRESHOLD, type PriceThreshold } from "@/domain/PriceHistory";
import { apiFetch } from "./apiFetch";
import { parsePriceThreshold } from "./priceThresholdInput";

type Saved = { audioLanguage: string; subtitleLanguage: string; amount: string; percent: string };
type PreferencesBody = {
  preferences: {
    audioLanguage: string | null;
    subtitleLanguage: string | null;
    priceDropThreshold?: PriceThreshold;
  };
};

// Valeurs des champs à partir de la réponse du serveur (« 0.5 » est affiché « 0,5 » par le champ numérique).
function toSaved(body: PreferencesBody): Saved {
  const threshold = body.preferences.priceDropThreshold ?? DEFAULT_PRICE_THRESHOLD;
  return {
    audioLanguage: body.preferences.audioLanguage ?? "",
    subtitleLanguage: body.preferences.subtitleLanguage ?? "",
    amount: String(threshold.amount),
    percent: String(threshold.percent),
  };
}
type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error" };

const byName = (a: string, b: string) => languageName(a).localeCompare(languageName(b), "fr");

// Liste de base triée par nom français ; la valeur enregistrée est ajoutée si elle n'y figure pas.
function optionsFor(current: string): string[] {
  const codes = current && current !== ORIGINAL_LANGUAGE && !PREFERENCE_LANGUAGES.includes(current) ? [...PREFERENCE_LANGUAGES, current] : PREFERENCE_LANGUAGES;
  return [...codes].sort(byName);
}

export function PreferencesView() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [saved, setSaved] = useState<Saved>({ audioLanguage: "", subtitleLanguage: "", amount: "", percent: "" });
  const [audio, setAudio] = useState("");
  const [subtitles, setSubtitles] = useState("");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/preferences", controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as PreferencesBody;
        if (controller.signal.aborted) return;
        const value = toSaved(body);
        setSaved(value);
        setAudio(value.audioLanguage);
        setSubtitles(value.subtitleLanguage);
        setAmount(value.amount);
        setPercent(value.percent);
        setLoad({ kind: "ready" });
      } catch {
        if (!controller.signal.aborted) setLoad({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, []);

  // Seuils comparés en nombres (« 0.50 » égale « 0.5 ») ; une saisie non analysable compte comme un changement.
  const parsedThreshold = parsePriceThreshold(amount, percent);
  const savedThreshold = parsePriceThreshold(saved.amount, saved.percent);
  const thresholdChanged =
    !parsedThreshold || !savedThreshold || parsedThreshold.amount !== savedThreshold.amount || parsedThreshold.percent !== savedThreshold.percent;
  const changed = audio !== saved.audioLanguage || subtitles !== saved.subtitleLanguage || thresholdChanged;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    // Le seuil n'est envoyé (et vérifié) que s'il a changé.
    if (thresholdChanged && !parsedThreshold) {
      setMessage({ ok: false, text: "Seuil de baisse invalide." });
      return;
    }
    setSending(true);
    try {
      const response = await apiFetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioLanguage: audio, subtitleLanguage: subtitles, ...(thresholdChanged ? { priceDropThreshold: parsedThreshold } : {}) }),
      });
      if (response.status === 400) {
        const error = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage({ ok: false, text: error?.message ?? "Préférences invalides." });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const value = toSaved((await response.json()) as PreferencesBody);
      setSaved(value);
      setAudio(value.audioLanguage);
      setSubtitles(value.subtitleLanguage);
      setAmount(value.amount);
      setPercent(value.percent);
      setMessage({ ok: true, text: "Préférences enregistrées" });
    } catch {
      setMessage({ ok: false, text: "Impossible d'enregistrer les préférences." });
    } finally {
      setSending(false);
    }
  }

  if (load.kind === "loading") return <p className="muted">Chargement…</p>;
  if (load.kind === "error") {
    return (
      <p role="alert" className="error">
        Impossible de charger les préférences.
      </p>
    );
  }

  return (
    <form className="pref-form" onSubmit={(e) => void save(e)}>
      <div className="pref-field">
        <span className="pref-icon">
          <SpeakerWaveIcon aria-hidden="true" />
        </span>
        <label className="pref-label" htmlFor="pref-audio">
          Langue audio par défaut
        </label>
        <p className="pref-help">Appliquée au filtre « Langue audio ».</p>
        <div>
          <select id="pref-audio" value={audio} onChange={(e) => setAudio(e.target.value)}>
            <option value="">Aucune</option>
            <option value={ORIGINAL_LANGUAGE}>Version originale</option>
            {optionsFor(saved.audioLanguage || audio).map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
          {audio === ORIGINAL_LANGUAGE && (
            <p className="pref-hint">
              <InformationCircleIcon aria-hidden="true" />
              <span>La langue originale de chaque titre (films étrangers en VO).</span>
            </p>
          )}
        </div>
      </div>
      <div className="pref-field">
        <span className="pref-icon">
          <ChatBubbleBottomCenterTextIcon aria-hidden="true" />
        </span>
        <label className="pref-label" htmlFor="pref-subtitles">
          Sous-titres par défaut
        </label>
        <p className="pref-help">Appliqués au filtre « Sous-titres ».</p>
        <div>
          <select id="pref-subtitles" value={subtitles} onChange={(e) => setSubtitles(e.target.value)}>
            <option value="">Aucune</option>
            {optionsFor(saved.subtitleLanguage || subtitles).map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="pref-field">
        <span className="pref-icon">
          <ArrowTrendingDownIcon aria-hidden="true" />
        </span>
        <span className="pref-label" id="pref-drop-label">
          Alertes de prix
        </span>
        <p className="pref-help">
          Une baisse de location ou d&apos;achat (France, HD et 4K) est signalée si elle atteint l&apos;un des deux seuils. 0 : toute baisse.
        </p>
        <div className="pref-threshold" role="group" aria-labelledby="pref-drop-label">
          <label className="pref-threshold-item" htmlFor="pref-amount">
            <span>Baisse d&apos;au moins</span>
            <span className="pref-threshold-input">
              <input id="pref-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span aria-hidden="true">€</span>
            </span>
          </label>
          <label className="pref-threshold-item" htmlFor="pref-percent">
            <span>ou d&apos;au moins</span>
            <span className="pref-threshold-input">
              <input id="pref-percent" type="text" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
              <span aria-hidden="true">%</span>
            </span>
          </label>
        </div>
      </div>
      <div className="pref-foot">
        <button type="submit" className="primary" disabled={!changed || sending}>
          Enregistrer
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "pref-saved" : "error"}>
            {message.ok && <CheckCircleIcon aria-hidden="true" />}
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
