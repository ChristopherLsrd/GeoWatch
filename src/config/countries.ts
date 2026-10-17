// Pays interrogés, par ordre de priorité. Liste modifiable.

// Premier lot, affiché en premier.
export const PRIORITY_1 = ["FR", "BE", "CH", "LU", "MC", "CA", "GF", "PF"];

export const PRIORITY_2 = ["SN", "CI", "CM", "CD", "BF", "ML", "NE", "TD", "GQ", "MG", "SC", "MU", "MA", "DZ", "TN"];

// Tous les pays couverts par JustWatch (relevé du 2026-10-17 sur
// https://apis.justwatch.com/content/locales/state).
export const JUSTWATCH_COUNTRIES = [
  "AD", "AE", "AG", "AL", "AO", "AR", "AT", "AU", "AZ", "BA", "BB", "BE", "BF", "BG", "BH", "BM", "BO", "BR", "BS",
  "BY", "BZ", "CA", "CD", "CH", "CI", "CL", "CM", "CO", "CR", "CU", "CV", "CY", "CZ", "DE", "DK", "DO", "DZ", "EC",
  "EE", "EG", "ES", "FI", "FJ", "FR", "GB", "GF", "GG", "GH", "GI", "GQ", "GR", "GT", "GY", "HK", "HN", "HR", "HU",
  "ID", "IE", "IL", "IN", "IQ", "IS", "IT", "JM", "JO", "JP", "KE", "KR", "KW", "LB", "LC", "LI", "LT", "LU", "LV",
  "LY", "MA", "MC", "MD", "ME", "MG", "MK", "ML", "MT", "MU", "MW", "MX", "MY", "MZ", "NE", "NG", "NI", "NL", "NO",
  "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PS", "PT", "PY", "QA", "RO", "RS", "RU", "SA", "SC", "SE",
  "SG", "SI", "SK", "SM", "SN", "SV", "TC", "TD", "TH", "TN", "TR", "TT", "TW", "TZ", "UA", "UG", "US", "UY", "VA",
  "VE", "XK", "YE", "ZA", "ZM", "ZW",
];

// Taille maximale d'un lot (une requête JustWatch par lot).
export const BATCH_SIZE = 20;
