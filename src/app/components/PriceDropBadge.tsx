import { ArrowTrendingDownIcon } from "@heroicons/react/24/solid";
import type { PriceDrop } from "@/application/prices/priceDrop";
import { MONETIZATION_LABELS } from "@/domain/MonetizationType";
import { formatPrice } from "./format";

// Pastille « en baisse » en surimpression sur l'affiche, ou dans le texte (inline), comme dans « Ma liste ».
// Rien s'il n'y a pas de baisse récente (`undefined` dans les anciennes copies locales).
export function PriceDropBadge({ drop, inline = false }: { drop: PriceDrop | null | undefined; inline?: boolean }) {
  if (!drop) return null;
  const label = `Prix en baisse : ${MONETIZATION_LABELS[drop.monetizationType].toLowerCase()} sur ${drop.platformName}, ${formatPrice(drop.previous, drop.currency)} → ${formatPrice(drop.value, drop.currency)}`;
  return (
    <span className={inline ? "poster-drop inline" : "poster-drop"} role="img" title={label} aria-label={label}>
      <ArrowTrendingDownIcon aria-hidden="true" />
      {`−${drop.percent} %`}
    </span>
  );
}
