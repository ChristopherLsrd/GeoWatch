import type { PriceHistoryView } from "@/application/prices/TitlePrices";
import { MONETIZATION_LABELS } from "@/domain/MonetizationType";
import { formatPrice } from "./format";
import { PriceChart } from "./PriceCurve";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Description de toute la courbe, pour les lecteurs d'écran.
function chartLabel(history: PriceHistoryView): string {
  const steps = history.points.map(
    (p) => `${formatPrice(p.value, p.currency)} le ${dateFormat.format(new Date(`${p.day}T00:00:00Z`))}`,
  );
  return `Évolution du prix : ${steps.join(", ")}`;
}

// Historique des prix de location et d'achat d'une ligne pays, par plateforme et par type.
export function PriceHistoryBlock({
  histories,
  multiVariant,
}: {
  histories: PriceHistoryView[];
  multiVariant: boolean;
}) {
  // Location avant achat, puis par nom de plateforme.
  const sorted = [...histories].sort(
    (a, b) =>
      (a.monetizationType === b.monetizationType ? 0 : a.monetizationType === "RENT" ? -1 : 1) ||
      a.platformName.localeCompare(b.platformName, "fr"),
  );
  return (
    <div className="price-history">
      <div className="price-history-title">Historique des prix</div>
      {sorted.map((history) => {
        const last = history.points[history.points.length - 1];
        if (!last) return null;
        return (
          <div key={`${history.platformId}|${history.monetizationType}`}>
            <div className="price-history-line">
              <strong>
                {MONETIZATION_LABELS[history.monetizationType]}
                {multiVariant ? ` · ${history.platformName}` : ""}
              </strong>
              {" : "}
              {formatPrice(last.value, last.currency)}
              <span className="price-history-range">
                {" "}
                · plus bas {formatPrice(history.low, last.currency)} · plus haut{" "}
                {formatPrice(history.high, last.currency)}
              </span>
            </div>
            {history.points.length >= 2 && <PriceChart points={history.points} label={chartLabel(history)} />}
          </div>
        );
      })}
    </div>
  );
}
