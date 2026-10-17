"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { countryFlag, countryName } from "../../domain/Country";
import { BellIcon, HomeIcon, LanguageIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "./apiFetch";

type AlertItem = {
  id: string;
  kind: "AT_HOME" | "FRENCH_AUDIO";
  title: { id: string; name: string; posterUrl: string | null };
  platform: { id: string; name: string; iconUrl: string | null } | null;
  country: string | null;
  createdAt: string;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

// Nouveautés détectées par la vérification quotidienne sur la liste à voir.
export function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/alerts", controller.signal);
        if (!response.ok) return;
        const body = (await response.json()) as { alerts: AlertItem[] };
        if (!controller.signal.aborted) setAlerts(body.alerts);
      } catch {
        // Erreur de chargement ignorée : le panneau reste masqué.
      }
    })();
    return () => controller.abort();
  }, []);

  async function dismiss(alert: AlertItem) {
    setAlerts((current) => current.filter((a) => a.id !== alert.id));
    try {
      const response = await apiFetch(`/api/alerts/${encodeURIComponent(alert.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      // Restauration, en conservant l'ordre du plus récent au plus ancien.
      setAlerts((current) =>
        current.some((a) => a.id === alert.id)
          ? current
          : [...current, alert].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    }
  }

  async function dismissAll() {
    const previous = alerts;
    setAlerts([]);
    try {
      const response = await apiFetch("/api/alerts", { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setAlerts((current) => {
        const known = new Set(current.map((a) => a.id));
        return [...current, ...previous.filter((a) => !known.has(a.id))].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <section className="alerts" aria-labelledby="alerts-heading">
      <div className="alerts-head">
        <h2 id="alerts-heading" className="section-title">
          <BellIcon aria-hidden="true" />
          Nouveautés de ma liste
        </h2>
        <button type="button" className="ghost" onClick={dismissAll}>
          Tout masquer
        </button>
      </div>
      <ul className="alerts-list">
        {alerts.map((alert) => (
          <li key={alert.id} className="alert-row">
            <Link href={`/titre/${encodeURIComponent(alert.title.id)}`} className="alert-link">
              {alert.title.posterUrl ? (
                <img className="alert-poster" src={alert.title.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="alert-poster" />
              )}
              <span className="alert-kind" aria-hidden="true">
                {alert.kind === "AT_HOME" ? <HomeIcon /> : <LanguageIcon />}
              </span>
              <span className="alert-text">
                <strong>{alert.title.name}</strong>
                {alert.kind === "AT_HOME" ? (
                  <>
                    {" est arrivé sur "}
                    {alert.platform?.iconUrl && (
                      <img className="alert-platform-icon" src={alert.platform.iconUrl} alt="" />
                    )}
                    {alert.platform?.name ?? "une de vos plateformes"}
                    {alert.country && (
                      <>
                        {" ("}
                        <span className="flag" aria-hidden="true">
                          {countryFlag(alert.country)}
                        </span>{" "}
                        {countryName(alert.country)})
                      </>
                    )}
                  </>
                ) : (
                  " est maintenant disponible en VF"
                )}
                <span className="alert-date">{formatDate(alert.createdAt)}</span>
              </span>
            </Link>
            <button
              type="button"
              className="alert-dismiss"
              aria-label="Masquer cette nouveauté"
              onClick={() => dismiss(alert)}
            >
              <XMarkIcon aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
