import { formatScore } from "./format";

// Pastilles de notes IMDb / TMDB : en bas à gauche d'une affiche (le parent doit être en position: relative),
// ou dans le texte (inline), comme dans « Ma liste ».
export function PosterScores({
  imdbScore,
  tmdbScore,
  inline = false,
}: {
  imdbScore?: number | null;
  tmdbScore?: number | null;
  inline?: boolean;
}) {
  const scores = [
    { label: "IMDb", score: imdbScore },
    { label: "TMDB", score: tmdbScore },
  ].filter((s): s is { label: string; score: number } => s.score != null);
  if (scores.length === 0) return null;
  return (
    <span className={inline ? "poster-scores inline" : "poster-scores"}>
      {scores.map(({ label, score }) => (
        <span
          key={label}
          className="poster-score"
          role="img"
          aria-label={`Note ${label} : ${formatScore(score)} sur 10`}
        >
          <span aria-hidden="true">{label}</span>
          <strong aria-hidden="true">{formatScore(score)}</strong>
        </span>
      ))}
    </span>
  );
}
