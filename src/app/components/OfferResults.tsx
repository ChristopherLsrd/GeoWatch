"use client";

import { useMemo, useState } from "react";
import {
  filterOffers,
  groupOffers,
  type CountryRow,
  type OfferFilters,
  type PlatformGroup,
} from "@/application/catalog/groupOffers";
import { languageName } from "@/domain/Language";
import { MONETIZATION_LABELS, MONETIZATION_TYPES, type MonetizationType } from "@/domain/MonetizationType";
import type { Offer } from "@/domain/Offer";

const SUMMARY_LIMIT = 2;
const NOT_PROVIDED = "non renseigné";
const COUNTRY_LIMIT = 5;
const PLATFORM_FILTER_LIMIT = 5;

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

// Pastille de résumé d'un type : « Abonnement HD/4K », « Location dès 3,99 € », « Gratuit »...
function typeSummary(type: MonetizationType, offers: Offer[]): string {
  const ofType = offers.filter((o) => o.monetizationType === type);
  const label = MONETIZATION_LABELS[type];
  const priced = ofType.filter((o) => o.priceValue !== null && o.price);
  if (priced.length > 0) {
    const cheapest = priced.reduce((a, b) => ((b.priceValue as number) < (a.priceValue as number) ? b : a));
    return `${label} dès ${cheapest.price}`;
  }
  const qualities = [...new Set(ofType.map((o) => o.quality).filter(Boolean))];
  return qualities.length > 0 ? `${label} ${qualities.join("/")}` : label;
}

export function OfferResults({
  offers,
  complete,
  subscribedPlatformIds = [],
  defaultAudioLanguage,
  defaultSubtitleLanguage,
  defaultAudioLabel = "préférences",
}: {
  offers: Offer[];
  complete: boolean;
  subscribedPlatformIds?: string[];
  // undefined : préférences pas encore connues ; null : aucune préférence.
  defaultAudioLanguage?: string | null;
  defaultSubtitleLanguage?: string | null;
  // Mention affichée près du filtre audio quand il vient de la valeur par défaut (ex. « VO »).
  defaultAudioLabel?: string;
}) {
  const [types, setTypes] = useState<MonetizationType[]>([]);
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  const [allPlatformsShown, setAllPlatformsShown] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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
  const platformOptions = useMemo(
    () => groupOffers(offers, { subscribedPlatformIds }).map((g) => ({ id: g.id, name: g.name })),
    [offers, subscribedPlatformIds],
  );
  // Un groupe coché reste visible même au-delà des premiers.
  const visiblePlatformOptions = allPlatformsShown
    ? platformOptions
    : platformOptions.filter((p, index) => index < PLATFORM_FILTER_LIMIT || platformIds.includes(p.id));
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
      platformGroupIds: platformIds,
      audioLanguage: audio || undefined,
      subtitleLanguage: subtitles || undefined,
    };
    return groupOffers(filterOffers(offers, filters), { subscribedPlatformIds });
  }, [offers, types, platformIds, audio, subtitles, subscribedPlatformIds]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function toggleIn(setter: (updater: (previous: Set<string>) => Set<string>) => void, key: string) {
    setter((previous) => {
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
            {visiblePlatformOptions.map((platform) => (
              <label key={platform.id}>
                <input
                  type="checkbox"
                  checked={platformIds.includes(platform.id)}
                  onChange={() => setPlatformIds(toggle(platformIds, platform.id))}
                />
                {platform.name}
              </label>
            ))}
            {platformOptions.length > PLATFORM_FILTER_LIMIT && (
              <button type="button" className="link-button" onClick={() => setAllPlatformsShown(!allPlatformsShown)}>
                {allPlatformsShown ? "Réduire" : `Voir tout (${platformOptions.length})`}
              </button>
            )}
          </fieldset>
          <div className="selects">
            <label>
              <span className="filter-label">
                Langue audio{audioFromPrefs && <span className="pref-note"> ({defaultAudioLabel})</span>}
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

      {groups.map((group) => {
        const showAll = expandedGroups.has(group.id);
        const rows = showAll ? group.countries : group.countries.slice(0, COUNTRY_LIMIT);
        return (
          <section key={group.id} className="platform">
            <div className="platform-head">
              {group.iconUrl ? (
                <img className="platform-icon" src={group.iconUrl} alt="" loading="lazy" />
              ) : (
                <div className="platform-icon" />
              )}
              <div>
                <div className="platform-name">
                  {group.name}
                  {group.subscribed && <span className="badge badge-sub">Abonné</span>}
                </div>
                <div className="muted">disponible dans {group.countryCount} pays</div>
                {group.platforms.length > 1 && (
                  <div className="muted platform-includes">
                    Inclut : {group.platforms.map((p) => p.name).join(", ")}
                  </div>
                )}
              </div>
            </div>
            <div className="country-list">
              {rows.map((row) => {
                const key = `${group.id}|${row.country}`;
                return (
                  <CountryLine
                    key={key}
                    row={row}
                    group={group}
                    open={expanded.has(key)}
                    onToggle={() => toggleIn(setExpanded, key)}
                  />
                );
              })}
            </div>
            {group.countries.length > COUNTRY_LIMIT && (
              <button
                type="button"
                className="link-button show-more"
                onClick={() => toggleIn(setExpandedGroups, group.id)}
              >
                {showAll ? "Réduire" : `Voir les ${group.countries.length} pays`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CountryLine({
  row,
  group,
  open,
  onToggle,
}: {
  row: CountryRow;
  group: PlatformGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const multiVariant = group.platforms.length > 1;
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
        <span className="type-pills">
          {row.types.map((type) => (
            <span key={type} className="badge">
              {typeSummary(type, row.offers)}
            </span>
          ))}
        </span>
      </button>
      {open && (
        <div className="detail">
          {row.offers.map((offer, index) => {
            const link = offer.deepLinkUrl ?? offer.url;
            return (
              <div key={index} className="detail-offer">
                <div>
                  <strong>{MONETIZATION_LABELS[offer.monetizationType]}</strong>
                  {multiVariant && <span className="muted"> · {offer.platform.name}</span>}
                </div>
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
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {offer.deepLinkUrl ? `Regarder sur ${offer.platform.name}` : `Voir sur ${offer.platform.name}`}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
