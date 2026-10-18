import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { addTiming } from "@/infrastructure/timing/requestTiming";
import { withTiming } from "./withTiming";

describe("withTiming", () => {
  it("ajoute l'en-tête Server-Timing à la réponse du handler", async () => {
    const handler = withTiming(async (id: string) => {
      addTiming("mongo", 4);
      return NextResponse.json({ id });
    });
    const response = await handler("tm1");
    expect(await response.json()).toEqual({ id: "tm1" });
    expect(response.headers.get("Server-Timing")).toMatch(/^mongo;dur=4\.0, justwatch;dur=0\.0, total;dur=\d+\.\d$/);
  });

  it("renvoie la réponse telle quelle si ses en-têtes sont immuables", async () => {
    const immutable = Response.redirect("https://example.com/", 302);
    const handler = withTiming(async () => immutable);
    await expect(handler()).resolves.toBe(immutable);
  });
});
