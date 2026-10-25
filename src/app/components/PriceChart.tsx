"use client";

import { useState, type KeyboardEvent } from "react";
import { parisDay } from "@/domain/CalendarDay";
import type { PricePoint } from "@/domain/PriceHistory";
import { formatDay, formatPrice } from "./format";
import { stepChart } from "./priceSteps";

const WIDTH = 240;
const HEIGHT = 48;

// « 3,99 € depuis le 11 oct. 2026 ». Le jour du premier point peut être inventé (veille du premier
// changement vu) : il se lit « 5,99 € avant le 20 oct. 2026 », avec le jour du point suivant.
function describePoint(points: PricePoint[], index: number): string {
  const price = formatPrice(points[index].value, points[index].currency);
  if (index === 0 && points.length >= 2) return `${price} avant le ${formatDay(points[1].day)}`;
  return `${price} depuis le ${formatDay(points[index].day)}`;
}

// Courbe en escalier du prix. `points` : déjà filtrés sur la devise actuelle.
export function PriceChart({ points }: { points: PricePoint[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const chart = stepChart(points, parisDay(new Date()), WIDTH, HEIGHT);
  if (!chart) return null;

  const active = Math.min(selected ?? chart.points.length - 1, chart.points.length - 1);
  const label = `Évolution du prix : ${points.map((_, index) => describePoint(points, index)).join(", ")}`;

  function onKeyDown(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected(index);
    }
  }

  return (
    <>
      <svg viewBox="-6 -6 252 60" className="price-chart" role="group" aria-label={label}>
        <path d={chart.path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {chart.points.map((point, index) => (
          // Le cercle transparent agrandit la zone de toucher sans changer le dessin.
          <g
            key={point.day}
            className={index === active ? "price-chart-point is-selected" : "price-chart-point"}
            tabIndex={0}
            role="button"
            aria-label={describePoint(points, index)}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <title>{describePoint(points, index)}</title>
            <circle className="price-chart-hit" cx={point.x} cy={point.y} r={12} />
            <circle className="price-chart-dot" cx={point.x} cy={point.y} r={4} />
          </g>
        ))}
      </svg>
      <div className="price-chart-caption">{describePoint(points, active)}</div>
    </>
  );
}
