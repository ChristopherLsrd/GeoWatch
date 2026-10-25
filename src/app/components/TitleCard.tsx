import Link from "next/link";
import type { PriceDrop } from "@/application/prices/priceDrop";
import type { Subscription } from "@/domain/Subscription";
import { HomeBadge } from "./HomeBadge";
import { PosterScores } from "./PosterScores";
import { PriceDropBadge } from "./PriceDropBadge";

// Carte de titre (affiche, nom, lignes de détail), partagée par l'accueil et la page d'une personne.
export function TitleCard({
  id,
  name,
  posterUrl,
  meta,
  availableAtHome,
  imdbScore,
  tmdbScore,
  priceDrop,
}: {
  id: string;
  name: string;
  posterUrl: string | null;
  // Lignes sous le titre (année et durée, réalisateur…), vides ignorées.
  meta: string[];
  availableAtHome: Subscription[] | null;
  imdbScore?: number | null;
  tmdbScore?: number | null;
  priceDrop?: PriceDrop | null;
}) {
  return (
    <Link href={`/titre/${encodeURIComponent(id)}`} className="card">
      <span className="card-media">
        {posterUrl ? (
          <img className="card-poster" src={posterUrl} alt="" loading="lazy" />
        ) : (
          <span className="card-poster" />
        )}
        <HomeBadge item={{ availableAtHome }} />
        <PriceDropBadge drop={priceDrop} />
        <PosterScores imdbScore={imdbScore} tmdbScore={tmdbScore} />
      </span>
      <span className="card-title">{name}</span>
      {meta
        .filter((line) => line)
        .map((line, index) => (
          <span key={index} className="card-meta" title={line}>
            {line}
          </span>
        ))}
    </Link>
  );
}
