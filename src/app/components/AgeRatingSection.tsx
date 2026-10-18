"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { isKnownAgeRating } from "@/config/ageRatings";
import { ADVISORY_CATEGORIES, type ContentAdvisory } from "@/domain/ContentAdvisory";
import { countryFlag, countryName } from "@/domain/Country";
import type { TitleType } from "@/domain/Title";
import type { AgeRating } from "@/domain/TitleDetails";
import { ADVISORY_LABELS, SEVERITY_LABELS, ratingHref } from "./advisoryLabels";

// Nombre de raisons visibles sur mobile avant « Voir tout ».
const COLLAPSED_COUNT = 2;

// Pastille de classification d'âge et raisons du guide parental, cliquables vers la liste des titres classés pareil.
export function AgeRatingSection({
  ageRating,
  advisory,
  type,
  imdbId,
}: {
  ageRating: AgeRating | null;
  advisory: ContentAdvisory | null;
  type: TitleType;
  imdbId: string | null;
}) {
  const listId = useId();
  // Mobile : seules les 2 premières raisons sont visibles tant que la liste n'est pas dépliée.
  const [expanded, setExpanded] = useState(false);
  if (!ageRating && !advisory) return null;

  const clickable = !!ageRating && isKnownAgeRating(ageRating.country, ageRating.code);
  // Les codes américains sont propres aux films ou aux séries : le type n'est transmis que pour la France.
  const typeFilter = ageRating?.country === "FR" ? { type } : {};
  const reasons = advisory ? ADVISORY_CATEGORIES.filter((c) => advisory[c]) : [];

  let pill = null;
  if (ageRating) {
    const { country, code } = ageRating;
    const text = country === "FR" ? code : `${countryFlag(country)} ${code}`;
    const title = country === "FR" ? undefined : `Classification ${countryName(country)}`;
    pill = clickable ? (
      <Link
        className="age-rating"
        href={ratingHref(country, code, typeFilter)}
        title={title}
        aria-label={`Titres classés ${code} (${countryName(country)})`}
      >
        {text}
      </Link>
    ) : (
      <span className="age-rating" title={title}>
        {text}
      </span>
    );
  }

  return (
    <div className="age-section">
      <div className="age-row">
        {pill}
        {reasons.length > 0 && (
          <ul id={listId} className={`advisory-list${expanded ? " is-expanded" : ""}`}>
            {reasons.map((c, i) => {
              const severity = advisory![c]!;
              const label = `${ADVISORY_LABELS[c]} : ${SEVERITY_LABELS[severity]}`;
              return (
                <li key={c} data-severity={severity} className={i >= COLLAPSED_COUNT ? "advisory-extra" : undefined}>
                  {clickable ? (
                    <Link href={ratingHref(ageRating!.country, ageRating!.code, { ...typeFilter, advisory: { [c]: severity } })}>
                      {label}
                    </Link>
                  ) : (
                    <span>{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {reasons.length > COLLAPSED_COUNT && (
          <button
            type="button"
            className="ghost link-accent advisory-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Réduire" : `Voir tout (${reasons.length})`}
          </button>
        )}
      </div>
      {reasons.length > 0 && (
        <p className="advisory-source">
          {imdbId ? (
            <a href={`https://www.imdb.com/title/${imdbId}/parentalguide`} target="_blank" rel="noopener noreferrer">
              Guide parental IMDb
            </a>
          ) : (
            "Guide parental IMDb"
          )}
        </p>
      )}
    </div>
  );
}
