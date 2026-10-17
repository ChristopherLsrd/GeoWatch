import type { WatchlistOverviewItem } from "@/application/watchlist/WatchlistOverview";
import { countryName } from "@/domain/Country";

// Élément de la liste à voir tel que reçu en JSON : la date d'ajout est une chaîne ISO
// (`details.fetchedAt`, une chaîne aussi en réalité, n'est pas utilisé côté client).
export type OverviewItem = Omit<WatchlistOverviewItem, "addedAt"> & {
  addedAt: string;
};

// Réalisateurs : 2 au maximum, puis « … ». Chaîne vide si inconnus.
export function directorsLabel(details: OverviewItem["details"]): string {
  const directors = details?.directors ?? [];
  if (directors.length === 0) return "";
  return directors.slice(0, 2).join(", ") + (directors.length > 2 ? "…" : "");
}

// Badge en surimpression sur l'affiche ; rien si le titre n'est pas disponible chez l'utilisateur.
export function HomeBadge({ item }: { item: Pick<OverviewItem, "availableAtHome"> }) {
  const subscriptions = item.availableAtHome;
  if (!subscriptions || subscriptions.length === 0) return null;
  const label = `Disponible chez moi : ${subscriptions
    .map((s) => `${s.platform.name} (${countryName(s.country)})`)
    .join(", ")}`;
  return (
    <span className="poster-badge" title={label} aria-label={label} role="img">
      Chez moi
    </span>
  );
}
