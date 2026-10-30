import { describe, expect, it } from "vitest";
import type { PushSender } from "@/domain/ports/PushSender";
import { TEST_MESSAGE } from "./pushMessages";
import { device, fakePush } from "./fakes";
import { deliverAll } from "./deliver";

describe("deliverAll", () => {
  it("sert les appareils en parallèle", async () => {
    const push = fakePush([device("e1"), device("e2"), device("e3")]);
    let inFlight = 0;
    let maxInFlight = 0;
    const slow: PushSender = {
      send: async () => {
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
      },
    };
    const deliveries = await deliverAll(slow, push.subscriptions, [TEST_MESSAGE]);
    expect(maxInFlight).toBe(3);
    expect(deliveries.map(({ device: d, delivery }) => [d.endpoint, delivery.sent])).toEqual([
      ["e1", 1],
      ["e2", 1],
      ["e3", 1],
    ]);
  });
});
