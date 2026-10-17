// Regroupement des variantes d'un même service sous une seule plateforme à l'affichage
// (Netflix et « Netflix Standard with Ads », Prime Video et ses chaînes…). Liste modifiable.
// La première règle qui correspond au nom JustWatch l'emporte : les chaînes passent donc
// avant les services eux-mêmes (« Paramount+ Amazon Channel » va dans Prime Video).

export type PlatformGroupRule = { key: string; name: string; match: RegExp };

export const PLATFORM_GROUP_RULES: PlatformGroupRule[] = [
  { key: "amazon", name: "Prime Video", match: /Amazon Channel\s*$|^Amazon (Prime Video|Video)\b/i },
  { key: "apple", name: "Apple TV", match: /Apple TV Channel\s*$|^Apple TV\b|\bon Apple TV$/i },
  { key: "roku", name: "The Roku Channel", match: /Roku Premium Channel$|^The Roku Channel$/i },
  { key: "netflix", name: "Netflix", match: /^Netflix\b/i },
  { key: "canal", name: "Canal+", match: /^Canal(\+| VOD)/i },
  { key: "paramount", name: "Paramount+", match: /^Paramount(\+| Plus)/i },
  { key: "youtube", name: "YouTube", match: /^YouTube\b/i },
  { key: "peacock", name: "Peacock", match: /^Peacock\b/i },
  { key: "arte", name: "ARTE", match: /^ARTE\b/i },
  { key: "pluto", name: "Pluto TV", match: /^Pluto TV\b/i },
  { key: "mgm", name: "MGM+", match: /^MGM(\+| Plus)/i },
  { key: "starz", name: "Starz", match: /^Starz\b/i },
];
