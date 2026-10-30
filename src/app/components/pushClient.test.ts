import { describe, expect, it } from "vitest";
import { base64UrlToBytes, testResultText, usesKey } from "./pushClient";

describe("base64UrlToBytes", () => {
  it("décode le base64url sans remplissage", () => {
    expect([...base64UrlToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("testResultText", () => {
  it("résume l'envoi de la notification de test", () => {
    expect(testResultText([{ device: "A", ok: true, error: null }])).toEqual({ ok: true, text: "Envoyée à 1 appareil" });
    expect(testResultText([{ device: "A", ok: true, error: null }, { device: "B", ok: true, error: null }])).toEqual({ ok: true, text: "Envoyée à 2 appareils" });
    expect(testResultText([{ device: "A", ok: true, error: null }, { device: "B", ok: false, error: "Délai dépassé" }])).toEqual({
      ok: false,
      text: "Envoyée à 1 appareil. B : Délai dépassé",
    });
    expect(testResultText([{ device: "B", ok: false, error: null }])).toEqual({ ok: false, text: "B : échec" });
    expect(testResultText([])).toEqual({ ok: false, text: "Aucun appareil enregistré." });
  });
});

describe("usesKey", () => {
  const key = new Uint8Array([1, 2, 3]);
  it("compare la clé de l'abonnement à la clé publique reçue", () => {
    expect(usesKey({ options: { userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]).buffer } }, key)).toBe(true);
    expect(usesKey({ options: { userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 4]).buffer } }, key)).toBe(false);
    expect(usesKey({ options: { userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2]).buffer } }, key)).toBe(false);
    expect(usesKey({ options: { userVisibleOnly: true, applicationServerKey: null } }, key)).toBe(false);
  });
});
