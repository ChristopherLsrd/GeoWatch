import { MONETIZATION_LABELS } from "@/domain/MonetizationType";
import { formatPrice } from "./format";
import { PriceChart } from "./PriceChart";
import type { SelectedPriceHistory } from "./priceHistorySelection";

// Historique des prix de location et d'achat d'une ligne pays, déjà triés par le serveur.
export function PriceHistoryBlock({
  histories,
  multiVariant,
}: {
  histories: SelectedPriceHistory[];
  multiVariant: boolean;
}) {
  return (
    <div className="price-history">
      <div className="price-history-title">Historique des prix</div>
      {histories.map(({ history, current, currency, low, high, points }) => (
        <div key={`${history.platformId}|${history.monetizationType}`}>
          <div className="price-history-line">
            <strong>
              {MONETIZATION_LABELS[history.monetizationType]}
              {multiVariant ? ` · ${history.platformName}` : ""}
            </strong>
            {" : "}
            {formatPrice(current.value, current.currency)}
            <span className="price-history-range">
              {" "}
              · plus bas {formatPrice(low, currency)} · plus haut {formatPrice(high, currency)}
            </span>
          </div>
          {points.length >= 2 && <PriceChart points={points} />}
        </div>
      ))}
    </div>
  );
}
