import { describe, expect, it } from "vitest";
import { config } from "./middleware";

// Le matcher est une expression de chemin Next.js ; on teste sa partie négative comme une regex.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("matcher du middleware", () => {
  it("laisse passer le manifeste et les icônes sans session", () => {
    expect(matcher.test("/manifest.webmanifest")).toBe(false);
    expect(matcher.test("/icons/192")).toBe(false);
    expect(matcher.test("/icons/maskable-512")).toBe(false);
  });

  it("protège toujours les pages, dont /partage, et les routes API", () => {
    expect(matcher.test("/")).toBe(true);
    expect(matcher.test("/partage")).toBe(true);
    expect(matcher.test("/api/search")).toBe(true);
  });
});
