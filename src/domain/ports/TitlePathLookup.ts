// Retrouve un titre du catalogue à partir du chemin de sa page (lien JustWatch partagé,
// « /fr/film/les-evades »). null : chemin inconnu, ou page qui n'est pas un film ni une série.

export interface TitlePathLookup {
  byPath(path: string): Promise<string | null>;
}
