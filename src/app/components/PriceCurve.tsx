"use client";

import { useState, type KeyboardEvent } from "react";
import { parisDay } from "@/domain/CalendarDay";
import type { PricePoint } from "@/domain/PriceHistory";
import { formatPrice } from "./format";
import { stepChart } from "./priceChart";

const WIDTH = 240;
const HEIGHT = 48;

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(day: string): string {
  return dateFormat.format(new Date(`${day}T00:00:00Z`));
}

// Courbe en escalier du prix. `points` : déjà filtrés sur la devise actuelle.
export function PriceChart({ points, label }: { points: PricePoint[]; label: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const chart = stepChart(points, parisDay(new Date()), WIDTH, HEIGHT);
  if (!chart) return null;

  const currency = points[points.length - 1].currency;
  const active = selected ?? chart.points.length - 1;
  const caption = (index: number) =>
    `${formatPrice(chart.points[index].value, currency)} depuis le ${formatDay(chart.points[index].day)}`;

  function onKeyDown(event: KeyboardEvent<SVGCircleElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected(index);
    }
  }

  return (
    <>
      <svg viewBox="-4 -4 248 56" className="price-chart" role="img" aria-label={label}>
        <path d={chart.path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {chart.points.map((point, index) => (
          <circle
            key={point.day}
            cx={point.x}
            cy={point.y}
            r={4}
            className={index === active ? "is-selected" : undefined}
            tabIndex={0}
            role="button"
            aria-label={caption(index)}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <title>{caption(index)}</title>
          </circle>
        ))}
      </svg>
      <div className="price-chart-caption">{caption(active)}</div>
    </>
  );
}
