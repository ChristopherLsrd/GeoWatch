import { createHash, timingSafeEqual } from "node:crypto";

// Comparaison en temps constant : on compare les empreintes SHA-256,
// qui ont toujours la même longueur, pour ne rien révéler de la longueur du mot de passe.
export function isAppPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD manquant");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}
