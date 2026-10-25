import { PRICE_DROP_BADGE_DAYS, type PriceDrop } from "@/application/prices/priceDrop";
import { daysBetween, parisDay } from "@/domain/CalendarDay";
import { formatPrice } from "./format";

// Texte de la pastille : le pourcentage, ou le montant quand le pourcentage arrondi vaut 0.
// `null` si la baisse est expirée (une copie locale peut en garder une de plus de 7 jours).
export function priceDropText(drop: PriceDrop, now: Date = new Date()): string | null {
  if (daysBetween(drop.day, parisDay(now)) > PRICE_DROP_BADGE_DAYS) return null;
  if (drop.percent > 0) return `−${drop.percent} %`;
  return `−${formatPrice(drop.previous - drop.value, drop.currency)}`;
}
