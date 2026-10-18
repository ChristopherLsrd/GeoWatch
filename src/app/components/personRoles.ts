import type { PersonRole } from "@/domain/Person";

// Valeur du paramètre d'URL `role` pour chaque onglet de la page d'une personne.
export const ROLE_PARAMS: Record<PersonRole, string> = {
  DIRECTOR: "realisation",
  ACTOR: "interpretation",
  OTHER: "autres",
};
