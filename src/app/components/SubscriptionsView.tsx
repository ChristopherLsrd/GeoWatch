"use client";

import { useEffect, useMemo, useState } from "react";
import { JUSTWATCH_COUNTRIES, PRIORITY_1 } from "@/config/countries";
import { countryFlag, countryName } from "@/domain/Country";
import type { Platform } from "@/domain/Offer";
import { DEFAULT_SUBSCRIPTION_COUNTRY, type Subscription } from "@/domain/Subscription";
import { apiFetch } from "./apiFetch";

type ListState = { kind: "loading" } | { kind: "ready"; subscriptions: Subscription[] } | { kind: "error" };
type PlatformsState = { kind: "loading" } | { kind: "ready"; platforms: Platform[] } | { kind: "error" };

const byName = (a: string, b: string) => countryName(a).localeCompare(countryName(b), "fr");

// Pays prioritaires en tête (dans leur ordre), puis les autres par nom français.
const PRIORITY_COUNTRIES = PRIORITY_1.filter((code) => JUSTWATCH_COUNTRIES.includes(code));
const OTHER_COUNTRIES = JUSTWATCH_COUNTRIES.filter((code) => !PRIORITY_1.includes(code)).sort(byName);

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SubscriptionsView() {
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/subscriptions", controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { subscriptions: Subscription[] };
        if (!controller.signal.aborted) setList({ kind: "ready", subscriptions: body.subscriptions });
      } catch {
        if (!controller.signal.aborted) setList({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, []);

  const subscriptions = useMemo(() => (list.kind === "ready" ? list.subscriptions : []), [list]);

  // Regroupement par pays, ordre d'ajout conservé à l'intérieur d'un pays.
  const groups = useMemo(() => {
    const byCountry = new Map<string, Subscription[]>();
    for (const subscription of subscriptions) {
      byCountry.set(subscription.country, [...(byCountry.get(subscription.country) ?? []), subscription]);
    }
    return [...byCountry.entries()].sort(([a], [b]) => byName(a, b));
  }, [subscriptions]);

  function add(subscription: Subscription) {
    setList((previous) =>
      previous.kind === "ready" &&
      !previous.subscriptions.some(
        (s) => s.platform.id === subscription.platform.id && s.country === subscription.country,
      )
        ? { kind: "ready", subscriptions: [...previous.subscriptions, subscription] }
        : previous,
    );
  }

  async function remove(subscription: Subscription) {
    setError(null);
    try {
      const response = await apiFetch(
        `/api/subscriptions?platformId=${encodeURIComponent(subscription.platform.id)}&country=${subscription.country}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(String(response.status));
      setList((previous) =>
        previous.kind === "ready"
          ? {
              kind: "ready",
              subscriptions: previous.subscriptions.filter(
                (s) => !(s.platform.id === subscription.platform.id && s.country === subscription.country),
              ),
            }
          : previous,
      );
    } catch {
      setError("Impossible de retirer cet abonnement.");
    }
  }

  return (
    <div>
      {list.kind === "loading" && <p className="muted">Chargement…</p>}
      {list.kind === "error" && (
        <p role="alert" className="error">
          Impossible de charger les abonnements.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {list.kind === "ready" && groups.length === 0 && (
        <p className="muted">
          Aucun abonnement. Ajoutez vos plateformes pour voir le badge « disponible chez moi ».
        </p>
      )}
      {groups.map(([country, items]) => (
        <section key={country} className="platform">
          <div className="platform-head">
            <span aria-hidden="true">{countryFlag(country)}</span>
            <div className="platform-name">{countryName(country)}</div>
          </div>
          <ul className="sub-list">
            {items.map((subscription) => (
              <li key={subscription.platform.id} className="sub-item">
                <PlatformIcon platform={subscription.platform} />
                <span className="sub-name">{subscription.platform.name}</span>
                <button type="button" onClick={() => void remove(subscription)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {list.kind === "ready" && <AddForm subscriptions={subscriptions} onAdded={add} />}
    </div>
  );
}

function PlatformIcon({ platform }: { platform: Platform }) {
  return platform.iconUrl ? (
    <img className="platform-icon" src={platform.iconUrl} alt="" loading="lazy" />
  ) : (
    <div className="platform-icon" />
  );
}

function AddForm({
  subscriptions,
  onAdded,
}: {
  subscriptions: Subscription[];
  onAdded: (subscription: Subscription) => void;
}) {
  const [country, setCountry] = useState(DEFAULT_SUBSCRIPTION_COUNTRY);
  const [platforms, setPlatforms] = useState<PlatformsState>({ kind: "loading" });
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Les plateformes sont rechargées à chaque changement de pays.
  useEffect(() => {
    const controller = new AbortController();
    setPlatforms({ kind: "loading" });
    setFilter("");
    setError(null);
    (async () => {
      try {
        const response = await apiFetch(`/api/platforms?country=${country}`, controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { platforms: Platform[] };
        if (!controller.signal.aborted) setPlatforms({ kind: "ready", platforms: body.platforms });
      } catch {
        if (!controller.signal.aborted) setPlatforms({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [country]);

  const subscribedIds = useMemo(
    () => new Set(subscriptions.filter((s) => s.country === country).map((s) => s.platform.id)),
    [subscriptions, country],
  );

  const visible = useMemo(() => {
    if (platforms.kind !== "ready") return [];
    const needle = normalize(filter.trim());
    return platforms.platforms.filter((p) => normalize(p.name).includes(needle));
  }, [platforms, filter]);

  async function subscribe(platform: Platform) {
    setError(null);
    setPending(platform.id);
    try {
      const response = await apiFetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformId: platform.id, country }),
      });
      if (response.status === 503) return setError("JustWatch est momentanément indisponible.");
      if (response.status === 404) return setError("Cette plateforme n'existe pas dans ce pays.");
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { subscription: Subscription };
      onAdded(body.subscription);
    } catch {
      setError("Impossible d'ajouter cet abonnement.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="add-form">
      <h2>Ajouter un abonnement</h2>
      <div className="add-fields">
        <label>
          <span className="filter-label">Pays</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {PRIORITY_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {countryFlag(code)} {countryName(code)}
              </option>
            ))}
            <option disabled>──────────</option>
            {OTHER_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {countryFlag(code)} {countryName(code)}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          placeholder="Filtrer les plateformes…"
          aria-label="Filtrer les plateformes"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {platforms.kind === "loading" && <p className="muted">Chargement des plateformes…</p>}
      {platforms.kind === "error" && (
        <p role="alert" className="error">
          JustWatch est momentanément indisponible. Changez de pays ou rechargez la page pour réessayer.
        </p>
      )}
      {platforms.kind === "ready" && visible.length === 0 && <p className="muted">Aucune plateforme trouvée.</p>}
      {platforms.kind === "ready" && visible.length > 0 && (
        <ul className="platform-picker">
          {visible.map((platform) => {
            const already = subscribedIds.has(platform.id);
            return (
              <li key={platform.id}>
                <button
                  type="button"
                  className="platform-choice"
                  disabled={already || pending === platform.id}
                  onClick={() => void subscribe(platform)}
                >
                  <PlatformIcon platform={platform} />
                  <span className="sub-name">{platform.name}</span>
                  {already && <span className="badge">Ajouté</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
