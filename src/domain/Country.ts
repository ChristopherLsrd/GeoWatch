// Pays, identifié par son code ISO 3166-1 alpha-2 (« FR »).

export type CountryCode = string;

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });

export function isCountryCode(value: string): value is CountryCode {
  return /^[A-Z]{2}$/.test(value);
}

export function countryName(code: CountryCode): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// Drapeau emoji : chaque lettre devient un « regional indicator symbol ».
export function countryFlag(code: CountryCode): string {
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}
