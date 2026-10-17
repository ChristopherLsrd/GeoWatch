import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "un-secret-de-test-suffisamment-long";
const now = new Date("2026-10-17T10:00:00Z");

describe("session", () => {
  it("accepte un jeton qu'elle a signé", async () => {
    const token = await createSessionToken(SECRET, now);
    expect(await verifySessionToken(token, SECRET, now)).toBe(true);
  });

  it("refuse un jeton signé avec un autre secret", async () => {
    const token = await createSessionToken("autre-secret-tout-aussi-long", now);
    expect(await verifySessionToken(token, SECRET, now)).toBe(false);
  });

  it("refuse un jeton modifié", async () => {
    const token = await createSessionToken(SECRET, now);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ exp: 9999999999999 })).toString("base64url")}.${signature}`;
    expect(await verifySessionToken(forged, SECRET, now)).toBe(false);
  });

  it("refuse un jeton expiré", async () => {
    const token = await createSessionToken(SECRET, now);
    const later = new Date(now.getTime() + 31 * 24 * 3600 * 1000);
    expect(await verifySessionToken(token, SECRET, later)).toBe(false);
  });

  it("refuse un jeton absent ou mal formé", async () => {
    expect(await verifySessionToken(undefined, SECRET, now)).toBe(false);
    expect(await verifySessionToken("n'importe quoi", SECRET, now)).toBe(false);
    expect(await verifySessionToken("a.b.c", SECRET, now)).toBe(false);
  });
});
