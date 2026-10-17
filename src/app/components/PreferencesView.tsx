"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import { PREFERENCE_LANGUAGES } from "@/config/languages";
import { languageName } from "@/domain/Language";
import { ORIGINAL_LANGUAGE } from "@/domain/Preferences";
import { apiFetch } from "./apiFetch";

type Saved = { audioLanguage: string; subtitleLanguage: string };
type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error" };

const byName = (a: string, b: string) => languageName(a).localeCompare(languageName(b), "fr");

// Liste de base triée par nom français ; la valeur enregistrée est ajoutée si elle n'y figure pas.
function optionsFor(current: string): string[] {
  const codes = current && current !== ORIGINAL_LANGUAGE && !PREFERENCE_LANGUAGES.includes(current) ? [...PREFERENCE_LANGUAGES, current] : PREFERENCE_LANGUAGES;
  return [...codes].sort(byName);
}

export function PreferencesView() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [saved, setSaved] = useState<Saved>({ audioLanguage: "", subtitleLanguage: "" });
  const [audio, setAudio] = useState("");
  const [subtitles, setSubtitles] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/preferences", controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as {
          preferences: { audioLanguage: string | null; subtitleLanguage: string | null };
        };
        if (controller.signal.aborted) return;
        const value = {
          audioLanguage: body.preferences.audioLanguage ?? "",
          subtitleLanguage: body.preferences.subtitleLanguage ?? "",
        };
        setSaved(value);
        setAudio(value.audioLanguage);
        setSubtitles(value.subtitleLanguage);
        setLoad({ kind: "ready" });
      } catch {
        if (!controller.signal.aborted) setLoad({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, []);

  const changed = audio !== saved.audioLanguage || subtitles !== saved.subtitleLanguage;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSending(true);
    try {
      const response = await apiFetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioLanguage: audio, subtitleLanguage: subtitles }),
      });
      if (response.status === 400) {
        setMessage({ ok: false, text: "Langue invalide." });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        preferences: { audioLanguage: string | null; subtitleLanguage: string | null };
      };
      const value = {
        audioLanguage: body.preferences.audioLanguage ?? "",
        subtitleLanguage: body.preferences.subtitleLanguage ?? "",
      };
      setSaved(value);
      setAudio(value.audioLanguage);
      setSubtitles(value.subtitleLanguage);
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
