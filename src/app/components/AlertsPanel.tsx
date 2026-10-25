"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { countryFlag, countryName } from "../../domain/Country";
import { ArrowTrendingDownIcon, BellIcon, HomeIcon, LanguageIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { MONETIZATION_LABELS } from "../../domain/MonetizationType";
import { dropPercent } from "../../domain/PriceHistory";
import type { AlertPrice } from "../../domain/WatchStatus";
import { apiFetch } from "./apiFetch";
import { formatPrice } from "./format";

type AlertItem = {
  id: string;
  kind: "AT_HOME" | "FRENCH_AUDIO" | "PRICE_DROP";
  title: { id: string; name: string; posterUrl: string | null };
  platform: { id: string; name: string; iconUrl: string | null } | null;
  country: string | null;
  price?: AlertPrice | null;
  createdAt: string;
};

// Icône et nom de la plateforme d'une alerte.
function AlertPlatform({ platform, fallback }: { platform: AlertItem["platform"]; fallback: string }) {
  return (
    <>
      {platform?.iconUrl && <img className="alert-platform-icon" src={platform.iconUrl} alt="" />}
      {platform?.name ?? fallback}
    </>
  );
}

// Nombre de nouveautés visibles avant « Voir plus ».
const COLLAPSED_COUNT = 5;

const dateFormat =new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

// Nouveautés détectées par la vérification quotidienne sur la liste à voir.
export function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [expanded, setExpanded] = useState(false);

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

  const visibleAlerts = expanded ? alerts : alerts.slice(0, COLLAPSED_COUNT);

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
      <ul id="alerts-list" className="alerts-list">
        {visibleAlerts.map((alert) => (
          <li key={alert.id} className="alert-row">
            <Link href={`/titre/${encodeURIComponent(alert.title.id)}`} className="alert-link">
              {alert.title.posterUrl ? (
                <img className="alert-poster" src={alert.title.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="alert-poster" />
              )}
              <span className="alert-kind" aria-hidden="true">
                {alert.kind === "AT_HOME" ? (
                  <HomeIcon />
                ) : alert.kind === "PRICE_DROP" ? (
                  <ArrowTrendingDownIcon />
                ) : (
                  <LanguageIcon />
                )}
              </span>
              <span className="alert-text">
                <strong>{alert.title.name}</strong>
                {alert.kind === "AT_HOME" ? (
                  <>
                    {" est arrivé sur "}
                    <AlertPlatform platform={alert.platform} fallback="une de vos plateformes" />
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
                ) : alert.kind === "PRICE_DROP" ? (
                  alert.price ? (
                    <>
                      {`, ${MONETIZATION_LABELS[alert.price.monetizationType].toLowerCase()} sur `}
                      <AlertPlatform platform={alert.platform} fallback="une plateforme" />
                      {` : ${formatPrice(alert.price.previous, alert.price.currency)} → ${formatPrice(alert.price.value, alert.price.currency)}`}
                      {dropPercent(alert.price.previous, alert.price.value) > 0 &&
                        ` (−${dropPercent(alert.price.previous, alert.price.value)} %)`}
                    </>
                  ) : (
                    <>
                      {" a baissé de prix sur "}
                      <AlertPlatform platform={alert.platform} fallback="une plateforme" />
                    </>
                  )
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
      {alerts.length > COLLAPSED_COUNT && (
        <button
          type="button"
          className="ghost alerts-more"
          aria-expanded={expanded}
          aria-controls="alerts-list"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Réduire" : `Voir plus (${alerts.length - COLLAPSED_COUNT})`}
        </button>
      )}
    </section>
  );
}
