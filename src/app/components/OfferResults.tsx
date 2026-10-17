"use client";

import { useMemo, useState } from "react";
import { filterOffers, groupOffers, type CountryRow, type OfferFilters } from "@/application/catalog/groupOffers";
import { languageName } from "@/domain/Language";
import { MONETIZATION_LABELS, MONETIZATION_TYPES, type MonetizationType } from "@/domain/MonetizationType";
import type { Offer, Platform } from "@/domain/Offer";

const SUMMARY_LIMIT = 2;
const NOT_PROVIDED = "non renseigné";

// Langues triées par nom français.
function sortedLanguages(codes: Iterable<string>): string[] {
  return [...new Set(codes)].sort((a, b) => languageName(a).localeCompare(languageName(b), "fr"));
}

// « français, anglais +5 » ; liste complète si `full`.
function languageSummary(codes: string[], full = false): string {
  if (codes.length === 0) return NOT_PROVIDED;
  const names = codes.map(languageName);
  if (full || names.length <= SUMMARY_LIMIT + 1) return names.join(", ");
  return `${names.slice(0, SUMMARY_LIMIT).join(", ")} +${names.length - SUMMARY_LIMIT}`;
}

function offerLabel(offer: Offer): string {
  return offer.price ? `${offer.quality} ${offer.price}` : offer.quality;
}

export function OfferResults({
  offers,
  complete,
  subscribedPlatformIds = [],
  defaultAudioLanguage,
  defaultSubtitleLanguage,
}: {
  offers: Offer[];
  complete: boolean;
  subscribedPlatformIds?: string[];
  // undefined : préférences pas encore connues ; null : aucune préférence.
  defaultAudioLanguage?: string | null;
  defaultSubtitleLanguage?: string | null;
}) {
  const [types, setTypes] = useState<MonetizationType[]>([]);
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  const [audio, setAudio] = useState("");
  const [subtitles, setSubtitles] = useState("");
  const [prefsApplied, setPrefsApplied] = useState(false);
  const [audioTouched, setAudioTouched] = useState(false);
  const [subtitlesTouched, setSubtitlesTouched] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Les préférences s'appliquent une seule fois, sans écraser un choix déjà fait à la main.
  if (!prefsApplied && (defaultAudioLanguage !== undefined || defaultSubtitleLanguage !== undefined)) {
    setPrefsApplied(true);
    if (!audioTouched && defaultAudioLanguage) setAudio(defaultAudioLanguage);
    if (!subtitlesTouched && defaultSubtitleLanguage) setSubtitles(defaultSubtitleLanguage);
  }
  const audioFromPrefs = audio !== "" && audio === defaultAudioLanguage;
  const subtitlesFromPrefs = subtitles !== "" && subtitles === defaultSubtitleLanguage;

  // Options de filtre alimentées par les offres déjà reçues (avant filtrage).
  const platforms = useMemo(() => {
    const byId = new Map<string, Platform>();
    for (const offer of offers) byId.set(offer.platform.id, offer.platform);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [offers]);
  // La valeur sélectionnée figure toujours dans les options, même sans offre correspondante.
  const audioOptions = useMemo(
    () => sortedLanguages([...offers.flatMap((o) => o.audioLanguages), ...(audio ? [audio] : [])]),
    [offers, audio],
  );
  const subtitleOptions = useMemo(
    () => sortedLanguages([...offers.flatMap((o) => o.subtitleLanguages), ...(subtitles ? [subtitles] : [])]),
    [offers, subtitles],
  );

  const groups = useMemo(() => {
    const filters: OfferFilters = {
      monetizationTypes: types,
      platformIds,
      audioLanguage: audio || undefined,
      subtitleLanguage: subtitles || undefined,
    };
    return groupOffers(filterOffers(offers, filters), { subscribedPlatformIds });
  }, [offers, types, platformIds, audio, subtitles, subscribedPlatformIds]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function toggleRow(key: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  const hasFilters = types.length > 0 || platformIds.length > 0 || audio !== "" || subtitles !== "";

  return (
    <div>
      {offers.length > 0 && (
        <div className="filters">
          <fieldset className="filter-group">
            <legend>Type d&apos;offre</legend>
            {MONETIZATION_TYPES.map((type) => (
              <label key={type}>
                <input type="checkbox" checked={types.includes(type)} onChange={() => setTypes(toggle(types, type))} />
                {MONETIZATION_LABELS[type]}
              </label>
            ))}
          </fieldset>
          <fieldset className="filter-group">
            <legend>Plateforme</legend>
            {platforms.map((platform) => (
              <label key={platform.id}>
                <input
                  type="checkbox"
                  checked={platformIds.includes(platform.id)}
                  onChange={() => setPlatformIds(toggle(platformIds, platform.id))}
                />
                {platform.name}
              </label>
            ))}
          </fieldset>
          <div className="selects">
            <label>
              <span className="filter-label">
                Langue audio{audioFromPrefs && <span className="pref-note"> (préférences)</span>}
              </span>
              <select
                value={audio}
                onChange={(e) => {
                  setAudioTouched(true);
                  setAudio(e.target.value);
                }}
              >
                <option value="">Toutes</option>
                {audioOptions.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="filter-label">
                Sous-titres{subtitlesFromPrefs && <span className="pref-note"> (préférences)</span>}
              </span>
              <select
                value={subtitles}
                onChange={(e) => {
                  setSubtitlesTouched(true);
                  setSubtitles(e.target.value);
                }}
              >
                <option value="">Toutes</option>
                {subtitleOptions.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {complete && offers.length === 0 && (
        <p className="muted">Ce titre n&apos;est disponible nulle part sur les pays vérifiés.</p>
      )}
      {offers.length > 0 && groups.length === 0 && hasFilters && (
        <p className="muted filter-empty">
          <span>Aucune offre ne correspond aux filtres.</span>
          {(audioFromPrefs || subtitlesFromPrefs) && (
            <button
              type="button"
              onClick={() => {
                setAudioTouched(true);
                setSubtitlesTouched(true);
                setAudio("");
                setSubtitles("");
              }}
            >
              Retirer les filtres de langue
            </button>
          )}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.platform.id} className="platform">
          <div className="platform-head">
            {group.platform.iconUrl ? (
              <img className="platform-icon" src={group.platform.iconUrl} alt="" loading="lazy" />
            ) : (
              <div className="platform-icon" />
            )}
            <div>
              <div className="platform-name">
                {group.platform.name}
                {group.subscribed && <span className="badge badge-sub">Abonné</span>}
              </div>
              <div className="muted">
                disponible dans {group.countryCount} pays
              </div>
            </div>
          </div>
          {group.types.map((typeGroup) => (
            <div key={typeGroup.type} className="type-section">
              <h3>{typeGroup.label}</h3>
              {typeGroup.countries.map((row) => {
                const key = `${group.platform.id}|${typeGroup.type}|${row.country}`;
                return (
                  <CountryLine
                    key={key}
                    row={row}
                    platformName={group.platform.name}
                    open={expanded.has(key)}
                    onToggle={() => toggleRow(key)}
                  />
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function CountryLine({
  row,
  platformName,
  open,
  onToggle,
}: {
  row: CountryRow;
  platformName: string;
  open: boolean;
  onToggle: () => void;
}) {
  const qualities = [...new Set(row.offers.map(offerLabel))].join(", ");
  return (
    <div className="country">
      <button type="button" className="country-row" aria-expanded={open} onClick={onToggle}>
        <span className="country-name">
          {row.flag} {row.name}
        </span>
        <span>
          <span className="cell-label">Audio : </span>
          {languageSummary(row.audioLanguages)}
        </span>
        <span>
          <span className="cell-label">Sous-titres : </span>
          {languageSummary(row.subtitleLanguages)}
        </span>
        <span>{qualities}</span>
      </button>
      {open && (
        <div className="detail">
          {row.offers.map((offer, index) => (
            <div key={index} className="detail-offer">
              <div>
                <span className="badge">{offer.quality}</span>
                {offer.price ?? "—"}
              </div>
              <div>
                <strong>Audio :</strong> {languageSummary(offer.audioLanguages, true)}
              </div>
              <div>
                <strong>Sous-titres :</strong> {languageSummary(offer.subtitleLanguages, true)}
              </div>
              {offer.url && (
                <a href={offer.url} target="_blank" rel="noopener noreferrer">
                  Voir sur {platformName}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
