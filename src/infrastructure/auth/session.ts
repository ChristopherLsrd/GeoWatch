// Jeton de session signé (HMAC-SHA256), vérifiable dans le middleware grâce à Web Crypto.
// Format : base64url(charge utile JSON) + "." + base64url(signature).

export const SESSION_COOKIE = "geowatch_session";
export const SESSION_DURATION_SECONDS = 30 * 24 * 3600;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(secret: string, now = new Date()): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: now.getTime() + SESSION_DURATION_SECONDS * 1000 })));
  const signature = await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signatureText] = parts;
  const signature = fromBase64Url(signatureText);
  if (!signature) return false;

  // crypto.subtle.verify compare les signatures en temps constant.
  const valid = await crypto.subtle.verify("HMAC", await importKey(secret), signature, encoder.encode(payload));
  if (!valid) return false;

  try {
    const bytes = fromBase64Url(payload);
    const { exp } = JSON.parse(new TextDecoder().decode(bytes ?? new Uint8Array()));
    return typeof exp === "number" && exp > now.getTime();
  } catch {
    return false;
  }
}
