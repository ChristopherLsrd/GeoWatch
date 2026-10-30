import { describe, expect, it } from "vitest";
import type { Alert } from "@/domain/WatchStatus";
import { alertMessages } from "./pushMessages";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const apple = { id: "2", name: "Apple TV", iconUrl: null };

function alert(over: Partial<Alert>): Alert {
  return {
    id: "a",
    kind: "AT_HOME",
    title: { id: "tm1", name: "Dune", posterUrl: "https://images.example/dune.jpg" },
    platform: netflix,
    country: "FR",
    createdAt: new Date("2026-10-30T05:00:00Z"),
    ...over,
  };
}

// Les montants contiennent une espace insécable avant « € ».
const plain = (text: string) => text.replace(/\s/g, " ");

describe("alertMessages", () => {
  it("décrit une arrivée chez moi et ouvre la fiche", () => {
    expect(alertMessages([alert({})])).toEqual([
      { title: "Dune", body: "Disponible sur Netflix (France)", url: "/titre/tm1", image: "https://images.example/dune.jpg" },
    ]);
  });

  it("décrit une baisse de prix", () => {
    const [message] = alertMessages([
      alert({ kind: "PRICE_DROP", platform: apple, price: { previous: 3.99, value: 2.99, currency: "EUR", monetizationType: "RENT" } }),
    ]);
    expect(plain(message.body)).toBe("Location : 3,99 € → 2,99 € sur Apple TV");
  });

  it("se passe de plateforme, de pays, de prix et d'affiche absents", () => {
    const messages = alertMessages([
      alert({ platform: null, country: null, title: { id: "tm 2", name: "Alien", posterUrl: null } }),
      alert({ kind: "PRICE_DROP", platform: null, price: null }),
    ]);
    expect(messages[0]).toEqual({ title: "Alien", body: "Disponible sur une de vos plateformes", url: "/titre/tm%202" });
    expect(messages[1].body).toBe("Baisse de prix sur une plateforme");
  });

  it("une notification par alerte jusqu'à 3, un résumé au-delà", () => {
    expect(alertMessages([alert({}), alert({}), alert({})])).toHaveLength(3);
    expect(alertMessages([alert({}), alert({}), alert({}), alert({})])).toEqual([
      { title: "GeoWatch", body: "4 nouveautés dans votre liste", url: "/" },
    ]);
  });
});
