// Langue audio ou de sous-titres, telle que fournie par le catalogue (« fr », « en », « pt-BR »…).

export type LanguageCode = string;

const languageNames = new Intl.DisplayNames(["fr"], { type: "language" });

export function languageName(code: LanguageCode): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}
