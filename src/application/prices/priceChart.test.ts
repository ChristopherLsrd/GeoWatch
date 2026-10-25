import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/domain/PriceHistory";
import { stepChart } from "./priceChart";

const point = (day: string, value: number): PricePoint => ({ day, value, currency: "EUR", quality: "HD" });

describe("stepChart", () => {
  it("trace un escalier du premier point à aujourd'hui", () => {
    const chart = stepChart([point("2026-10-01", 4.99), point("2026-10-11", 3.99)], "2026-10-21", 200, 50);
    expect(chart?.path).toBe("M0 0 H100 V50 H200");
    expect(chart?.points.map((p) => [p.x, p.y])).toEqual([[0, 0], [100, 50]]);
    expect([chart?.low, chart?.high]).toEqual([3.99, 4.99]);
  });

  it("centre une courbe à prix constant et refuse moins de 2 points", () => {
    expect(stepChart([point("2026-10-01", 3.99), point("2026-10-11", 3.99)], "2026-10-11", 200, 50)?.path).toBe("M0 25 H200 V25 H200");
    expect(stepChart([point("2026-10-01", 3.99)], "2026-10-11", 200, 50)).toBeNull();
  });
});
