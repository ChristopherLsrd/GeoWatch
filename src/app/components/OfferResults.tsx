"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
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
import type { PriceHistoryView } from "@/application/prices/TitlePrices";
import { PriceHistoryBlock } from "./PriceHistoryBlock";
import { selectPriceHistories } from "./priceHistorySelection";

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
  priceHistories = [],
}: {
  offers: Offer[];
  complete: boolean;
  subscribedPlatformIds?: string[];
  // undefined : préférences pas encore connues ; null : aucune préférence.
  defaultAudioLanguage?: string | null;
  defaultSubtitleLanguage?: string | null;
  // Mention affichée près du filtre audio quand il vient de la valeur par défaut (ex. « VO »).
  defaultAudioLabel?: string;
  // Historiques de prix du titre (liste à voir) ; vide hors de la liste.
  priceHistories?: PriceHistoryView[];
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
  // Mobile uniquement : panneau de filtres replié par défaut (toujours visible sur grand écran).
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  function changeAudio(value: string) {
    setAudioTouched(true);
    setAudio(value);
  }

  function changeSubtitles(value: string) {
    setSubtitlesTouched(true);
    setSubtitles(value);
  }

  const hasFilters = types.length > 0 || platformIds.length > 0 || audio !== "" || subtitles !== "";
  const activeFilterCount =
    (types.length > 0 ? 1 : 0) + (platformIds.length > 0 ? 1 : 0) + (audio !== "" ? 1 : 0) + (subtitles !== "" ? 1 : 0);

  return (
    <div className="offer-results">
      {offers.length > 0 && (
        <>
          <section className="filters" aria-label="Filtres">
            <h2 className="section-title filters-title">
              <FunnelIcon aria-hidden="true" />
              Filtres
            </h2>
            <button
              type="button"
              className="filters-toggle"
              aria-expanded={filtersOpen}
              aria-controls="offer-filters-panel"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <FunnelIcon aria-hidden="true" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="filters-count" aria-label={`${activeFilterCount} filtres actifs`}>
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUpIcon className="filters-chevron" aria-hidden="true" />
              ) : (
                <ChevronDownIcon className="filters-chevron" aria-hidden="true" />
              )}
            </button>
            <div id="offer-filters-panel" className="filters-panel" data-open={filtersOpen}>
              <fieldset className="filter-group">
                <legend>Type d&apos;offre</legend>
                <div className="filter-options">
                  {MONETIZATION_TYPES.map((type) => (
                    <label key={type}>
                      <input
                        type="checkbox"
                        checked={types.includes(type)}
                        onChange={() => setTypes(toggle(types, type))}
                      />
                      {MONETIZATION_LABELS[type]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="filter-group">
                <legend>Plateforme</legend>
                <div className="filter-options">
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
                    <button
                      type="button"
                      className="ghost link-accent"
                      aria-expanded={allPlatformsShown}
                      onClick={() => setAllPlatformsShown(!allPlatformsShown)}
                    >
                      {allPlatformsShown ? "Réduire" : `Voir tout (${platformOptions.length})`}
                    </button>
                  )}
                </div>
              </fieldset>
              <div className="selects">
                <label>
                  <span className="filter-label">
                    Langue audio{audioFromPrefs && <span className="pref-note"> · {defaultAudioLabel}</span>}
                  </span>
                  <select value={audio} onChange={(e) => changeAudio(e.target.value)}>
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
                    Sous-titres{subtitlesFromPrefs && <span className="pref-note"> · préférences</span>}
                  </span>
                  <select value={subtitles} onChange={(e) => changeSubtitles(e.target.value)}>
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
          </section>

          {/* Mobile : filtres de langue actifs, supprimables sans ouvrir le panneau. */}
          {!filtersOpen && (audio !== "" || subtitles !== "") && (
            <div className="filter-chips">
              {audio !== "" && (
                <span className="filter-chip">
                  Audio : {languageName(audio)}
                  {audioFromPrefs ? ` (${defaultAudioLabel})` : ""}
                  <button type="button" aria-label="Retirer le filtre audio" onClick={() => changeAudio("")}>
                    <XMarkIcon aria-hidden="true" />
                  </button>
                </span>
              )}
              {subtitles !== "" && (
                <span className="filter-chip">
                  Sous-titres : {languageName(subtitles)}
                  <button type="button" aria-label="Retirer le filtre sous-titres" onClick={() => changeSubtitles("")}>
                    <XMarkIcon aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          )}
        </>
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
          <section key={group.id} className="platform" aria-label={group.name}>
            <div className="platform-head">
              {group.iconUrl ? (
                <img className="platform-icon" src={group.iconUrl} alt="" loading="lazy" />
              ) : (
                <div className="platform-icon" />
              )}
              <div>
                <div className="platform-name">
                  {group.name}
                  {group.subscribed && (
                    <span className="badge badge-sub">
                      <CheckIcon aria-hidden="true" />
                      Abonné
                    </span>
                  )}
                </div>
                <div className="platform-includes">
                  Disponible dans {group.countryCount} pays
                  {group.platforms.length > 1 && ` · inclut ${group.platforms.map((p) => p.name).join(", ")}`}
                </div>
              </div>
            </div>
            <div className="country-head" aria-hidden="true">
              <span>Pays</span>
              <span>Audio</span>
              <span>Sous-titres</span>
              <span>Offres</span>
              <span />
            </div>
            <div className="country-list">
              {rows.map((row) => {
                const key = `${group.id}|${row.country}`;
                return (
                  <CountryLine
                    key={key}
                    row={row}
                    group={group}
                    priceHistories={selectPriceHistories(
                      priceHistories,
                      row.country,
                      group.platforms.map((p) => p.id),
                      row.offers,
                    )}
                    open={expanded.has(key)}
                    onToggle={() => toggleIn(setExpanded, key)}
                  />
                );
              })}
            </div>
            {group.countries.length > COUNTRY_LIMIT && (
              <div className="platform-more">
                <button
                  type="button"
                  className="ghost link-accent"
                  aria-expanded={showAll}
                  onClick={() => toggleIn(setExpandedGroups, group.id)}
                >
                  {showAll ? "Réduire" : `Voir les ${group.countries.length} pays`}
                </button>
              </div>
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
  priceHistories,
  open,
  onToggle,
}: {
  row: CountryRow;
  group: PlatformGroup;
  priceHistories: PriceHistoryView[];
  open: boolean;
  onToggle: () => void;
}) {
  const multiVariant = group.platforms.length > 1;
  const Chevron = open ? ChevronUpIcon : ChevronDownIcon;
  return (
    <div className="country">
      <button type="button" className="country-row" aria-expanded={open} onClick={onToggle}>
        <span className="country-name">
          <span className="flag" aria-hidden="true">
            {row.flag}
          </span>
          {row.name}
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
            <span key={type} className={type === "FLATRATE" ? "badge is-sub" : "badge"}>
              {typeSummary(type, row.offers)}
            </span>
          ))}
        </span>
        <Chevron className="country-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="detail">
          {priceHistories.length > 0 && (
            <PriceHistoryBlock histories={priceHistories} multiVariant={multiVariant} />
          )}
          {row.offers.map((offer, index) => {
            const link = offer.deepLinkUrl ?? offer.url;
            return (
              <div key={index} className="detail-offer">
                <strong>
                  {MONETIZATION_LABELS[offer.monetizationType]}
                  {multiVariant && <span className="muted offer-platform"> · {offer.platform.name}</span>}
                </strong>
                <span>
                  <span className="badge">{offer.quality}</span>
                  {offer.price ?? "—"}
                </span>
                <span>
                  <span className="muted">Audio :</span> {languageSummary(offer.audioLanguages, true)}
                </span>
                <span>
                  <span className="muted">Sous-titres :</span> {languageSummary(offer.subtitleLanguages, true)}
                </span>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {offer.deepLinkUrl ? `Regarder sur ${offer.platform.name}` : `Voir sur ${offer.platform.name}`}
                    <ArrowTopRightOnSquareIcon aria-hidden="true" />
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
