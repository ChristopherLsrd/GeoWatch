import Link from "next/link";
import { isKnownAgeRating } from "@/config/ageRatings";
import { ADVISORY_CATEGORIES, type ContentAdvisory } from "@/domain/ContentAdvisory";
import { countryFlag, countryName } from "@/domain/Country";
import type { TitleType } from "@/domain/Title";
import type { AgeRating } from "@/domain/TitleDetails";
import { ADVISORY_LABELS, SEVERITY_LABELS, ratingHref } from "./advisoryLabels";

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
  if (!ageRating && !advisory) return null;

  const clickable = !!ageRating && isKnownAgeRating(ageRating.country, ageRating.code);
  const reasons = advisory ? ADVISORY_CATEGORIES.filter((c) => advisory[c]) : [];

  let pill = null;
  if (ageRating) {
    const { country, code } = ageRating;
    const text = country === "FR" ? code : `${countryFlag(country)} ${code}`;
    const title = country === "FR" ? undefined : `Classification ${countryName(country)}`;
    pill = clickable ? (
      <Link
        className="age-rating"
        href={ratingHref(country, code, { type })}
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
          <ul className="advisory-list">
            {reasons.map((c) => {
              const severity = advisory![c]!;
              const label = `${ADVISORY_LABELS[c]} : ${SEVERITY_LABELS[severity]}`;
              return (
                <li key={c} data-severity={severity}>
                  {clickable ? (
                    <Link href={ratingHref(ageRating!.country, ageRating!.code, { type, advisory: { [c]: severity } })}>
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </li>
              );
            })}
          </ul>
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
