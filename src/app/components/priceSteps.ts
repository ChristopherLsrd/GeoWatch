// Courbe des prix en escalier (le prix reste constant entre deux changements). Fonction pure, côté client.

import { daysBetween } from "@/domain/CalendarDay";
import type { PricePoint } from "@/domain/PriceHistory";

export type ChartPoint = { x: number; y: number; day: string; value: number };

const round = (n: number) => Math.round(n * 10) / 10;

// Du premier point à aujourd'hui, dans un cadre width × height (prix le plus haut en haut).
export function stepChart(
  points: PricePoint[],
  today: string,
  width: number,
  height: number,
): { path: string; points: ChartPoint[]; low: number; high: number } | null {
  if (points.length < 2) return null;
  const start = points[0].day;
  const last = points[points.length - 1].day;
  const span = Math.max(daysBetween(start, today > last ? today : last), 1);
  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const y = (value: number) => (high === low ? height / 2 : ((high - value) / (high - low)) * height);
  const chartPoints = points.map((p) => ({
    x: round((daysBetween(start, p.day) / span) * width),
    y: round(y(p.value)),
    day: p.day,
    value: p.value,
  }));
  const [first, ...rest] = chartPoints;
  const path = [`M${first.x} ${first.y}`, ...rest.map((p) => `H${p.x} V${p.y}`), `H${width}`].join(" ");
  return { path, points: chartPoints, low, high };
}
