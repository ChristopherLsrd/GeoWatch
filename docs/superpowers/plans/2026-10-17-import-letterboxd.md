# Import de la watchlist Letterboxd : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-compétence REQUISE, superpowers:subagent-driven-development (recommandée) ou superpowers:executing-plans, pour suivre le plan tâche par tâche. Les étapes sont des cases à cocher (`- [ ]`) qui servent au suivi.

**Objectif :** importer dans la liste à voir de GeoWatch le fichier `watchlist.csv` exporté de Letterboxd. Les correspondances sûres sont ajoutées automatiquement, les cas douteux sont soumis à validation et les films introuvables sont listés.

**Architecture :**
- Le navigateur lit le CSV avec une fonction pure de `application/import/`.
- Il envoie les films par lots de 5 à `POST /api/watchlist/import`.
- Le cas d'usage `ImportLetterboxd` cherche chaque film dans JustWatch (`CatalogProvider.searchTitles`) et le classe avec `matchLetterboxd`. S'il est sûr, il l'ajoute avec `Watchlist.add(titleId, { addedAt })`, sans vérifier les offres.
- Le serveur ne garde aucun état et n'ajoute aucune collection Mongo.

**Stack technique :** Next.js 15 App Router, React 19, TypeScript 5, Vitest (alias `@` vers `src`), MongoDB (`mongodb-memory-server` pour les tests en local).

**Spec :** `docs/superpowers/specs/2026-10-17-import-letterboxd-design.md`

## Contraintes globales

- Échanges, commentaires de code et textes de l'interface en **français**.
- Clean architecture du dépôt :
  - `src/domain` : types et ports, sans dépendance ;
  - `src/application` : cas d'usage et fonctions pures, testés ;
  - `src/infrastructure` : JustWatch, Mongo, `container.ts` ;
  - `src/app` : pages, composants, routes.
- JustWatch est toléré pour un usage privé. Il faut donc :
  - une **pause d'environ 1 s entre deux films** ;
  - **au plus 5 films par appel** de la route ;
  - **aucune vérification des offres** (`DailyCheck.checkTitle`) pendant l'import.
- Années compatibles : **± 1 an**. **5 candidats** au plus pour un film à valider. **300 caractères** au plus pour un titre.
- Commits au format Conventional Commits, détaillés, en français. Chaque message se termine par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Git :
  - branche `feat/import-letterboxd`, déjà créée depuis `main` et contenant la spec ;
  - la PR vise **`main`** ;
  - ne jamais pousser sur `main` ni fusionner.
- Le dépôt est **public** : vérifier qu'aucun secret n'est commité avant chaque push.
- Le front-end est délégué à un sous-agent Sonnet (`model: "sonnet"`), puis relu avant le commit.
- Lancer les tests avec `npm test`, qui exécute `vitest run`. Pour un seul fichier : `npx vitest run <chemin>`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/domain/Title.ts` (modifié) | champ facultatif `originalTitle` |
| `src/infrastructure/justwatch/JustWatchGraphqlCatalog.ts` (modifié) | `originalTitle` dans `TITLE_FIELDS` et `toTitle` |
| `src/application/watchlist/Watchlist.ts` (modifié) | option `addedAt` de `add` |
| `src/application/import/parseLetterboxdCsv.ts` (créé) | lecture du CSV, fonction pure, utilisée aussi côté client |
| `src/application/import/matchLetterboxd.ts` (créé) | normalisation des titres et classement des résultats de recherche |
| `src/application/import/ImportLetterboxd.ts` (créé) | cas d'usage : traitement d'un lot, validation d'un candidat |
| `src/infrastructure/container.ts` (modifié) | instance `importLetterboxd` |
| `src/app/api/watchlist/import/route.ts` (créé) | `POST` avec lot ou validation |
| `src/app/liste/import/page.tsx` (créé) | page de l'import |
| `src/app/components/LetterboxdImport.tsx` (créé) | interface de l'import |
| `src/app/components/WatchlistView.tsx` (modifié) | bouton « Importer depuis Letterboxd » |
| `src/app/globals.css` (modifié) | styles de l'import |

Tous les fichiers de test sont à côté de leur source (`*.test.ts`).

---

### Tâche 1 : titre original dans les résultats de recherche

**Fichiers :**
- Modifier `src/domain/Title.ts`
- Modifier `src/infrastructure/justwatch/JustWatchGraphqlCatalog.ts` : `TITLE_FIELDS` (lignes 17 à 26), le type `JustWatchTitle` (lignes 84 à 93) et `toTitle` (lignes 243 à 254)
- Test : `src/infrastructure/justwatch/JustWatchGraphqlCatalog.test.ts`, test « convertit les résultats de recherche… », vers la ligne 105

**Interfaces :**
- Produit : `Title.originalTitle?: string | null`. Il est rempli par `searchTitles`, `getTitle` et `getTitleDetails`. `getTitleDetails` le remplace ensuite par `details.originalTitle`, comme aujourd'hui.

- [ ] **Étape 1 : modifier le test pour qu'il échoue**

Dans le test « convertit les résultats de recherche et ignore ce qui n'est ni un film ni une série » :
- ajouter `originalTitle: "Inception"` dans `node.content` ;
- ajouter `originalTitle: "Inception"` dans l'objet attendu.

```ts
    const node = {
      id: "tm92641",
      objectType: "MOVIE",
      content: {
        title: "Inception",
        originalTitle: "Inception",
        originalReleaseYear: 2010,
        posterUrl: "/poster/8716170/s332/inception.jpg",
        externalIds: { imdbId: "tt1375666", tmdbId: "27205" },
      },
    };
    // … fakeFetch inchangé …
    expect(await new JustWatchGraphqlCatalog({ fetch: fn }).searchTitles("inception")).toEqual([
      {
        id: "tm92641",
        type: "MOVIE",
        name: "Inception",
        originalTitle: "Inception",
        year: 2010,
        posterUrl: "https://images.justwatch.com/poster/8716170/s332/inception.jpg",
        imdbId: "tt1375666",
        tmdbId: "27205",
      },
    ]);
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `npx vitest run src/infrastructure/justwatch/JustWatchGraphqlCatalog.test.ts`.
Résultat attendu : ÉCHEC, il manque `originalTitle` dans le résultat.

- [ ] **Étape 3 : implémenter**

Dans `src/domain/Title.ts`, sous `name: string;` :

```ts
  // Titre original (souvent anglais), pour retrouver un film cité sous ce nom (import Letterboxd).
  // Facultatif : absent des titres enregistrés avant son introduction.
  originalTitle?: string | null;
```

Dans `JustWatchGraphqlCatalog.ts` :
- `TITLE_FIELDS` : ajouter `originalTitle` sous `title` dans `content(...)` ;
- type `JustWatchTitle` : ajouter `originalTitle?: string | null;` dans `content` ;
- `toTitle` : ajouter la ligne `originalTitle: node.content.originalTitle || null,` après `name`.

```ts
const TITLE_FIELDS = `
  id
  objectType
  content(country: $country, language: $language) {
    title
    originalTitle
    originalReleaseYear
    posterUrl(profile: S332, format: JPG)
    externalIds { imdbId tmdbId }
  }
`;
```

Dans le test « convertit la fiche complète d'un titre », l'objet attendu contient déjà `originalTitle: "Inception"`, tiré de `details`. Il ne change pas.

`toWatchlistEntry` (`src/domain/WatchlistItem.ts`) choisit ses champs un par un. Le titre original n'est donc **pas** enregistré dans Mongo, et c'est voulu.

- [ ] **Étape 4 : vérifier que tout passe**

Lancer `npm test`.
Résultat attendu : tous les tests passent (78 ou plus).

- [ ] **Étape 5 : commiter**

```bash
git add src/domain/Title.ts src/infrastructure/justwatch/JustWatchGraphqlCatalog.ts src/infrastructure/justwatch/JustWatchGraphqlCatalog.test.ts
git commit -F - <<'EOF'
feat: titre original dans les résultats de recherche

La recherche JustWatch se fait en français et renvoie des titres
traduits (« Les Évadés »), alors que Letterboxd cite les films sous leur
titre anglais ou original. Title reçoit un champ facultatif
originalTitle, demandé dans TITLE_FIELDS et rempli par toTitle. Il n'est
pas enregistré dans la liste à voir (toWatchlistEntry inchangé).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 2 : option `addedAt` de `Watchlist.add`

**Fichiers :**
- Modifier `src/application/watchlist/Watchlist.ts` : méthode `add`
- Test : `src/application/watchlist/Watchlist.test.ts`

**Interfaces :**
- Produit : `Watchlist.add(titleId: string, options?: { addedAt?: Date }): Promise<WatchlistItem>`. Si `addedAt` est fourni, il remplace l'horloge pour `item.addedAt`. Le résumé garde `fetchedAt` à l'heure de l'horloge.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `describe("Watchlist", …)` :

```ts
  it("garde la date d'ajout fournie (import Letterboxd)", async () => {
    const { watchlist, now } = setup();
    const addedAt = new Date("2024-03-05T12:00:00Z");
    const item = await watchlist.add("tm92641", { addedAt });
    expect(item.addedAt).toEqual(addedAt);
    expect(item.details?.fetchedAt).toEqual(now);
  });
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `npx vitest run src/application/watchlist/Watchlist.test.ts`.
Résultat attendu : ÉCHEC. `item.addedAt` vaut `now`, ou TypeScript signale un argument en trop (vitest ne vérifie pas les types, donc l'échec vient de l'assertion).

- [ ] **Étape 3 : implémenter**

```ts
  // Le titre est relu dans le catalogue pour enregistrer des identifiants fiables et le résumé de sa fiche.
  // addedAt : date d'ajout d'origine (import Letterboxd) ; par défaut, maintenant.
  async add(titleId: string, options: { addedAt?: Date } = {}): Promise<WatchlistItem> {
    const existing = await this.repository.get(titleId);
    if (existing) return existing;
    const details = await this.catalog.getTitleDetails(titleId);
    if (!details) throw new TitleNotFoundError(titleId);
    const now = this.clock();
    const item: WatchlistItem = { ...toWatchlistEntry(details, now), note: "", addedAt: options.addedAt ?? now };
    await this.repository.add(item);
    return item;
  }
```

- [ ] **Étape 4 : vérifier que tout passe**

Lancer `npm test`. Résultat attendu : tous les tests passent.

- [ ] **Étape 5 : commiter**

```bash
git add src/application/watchlist/Watchlist.ts src/application/watchlist/Watchlist.test.ts
git commit -F - <<'EOF'
feat: date d'ajout facultative pour Watchlist.add

Option { addedAt } : l'import Letterboxd conserve la date d'ajout
d'origine, pour que le tri par date d'ajout respecte l'historique de
l'utilisateur. Sans l'option, comportement inchangé (horloge).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 3 : lecture du CSV Letterboxd

**Fichiers :**
- Créer `src/application/import/parseLetterboxdCsv.ts`
- Test : `src/application/import/parseLetterboxdCsv.test.ts`

**Interfaces :**
- Produit :
  ```ts
  export type LetterboxdEntry = { name: string; year: number | null; addedAt: string | null; letterboxdUri: string | null };
  export const MAX_NAME_LENGTH = 300;
  export class LetterboxdCsvError extends Error {}
  export function parseLetterboxdCsv(text: string): { entries: LetterboxdEntry[]; skipped: number };
  ```
  - `addedAt` est au format `AAAA-MM-JJ`, ou `null`.
  - `letterboxdUri` est gardé seulement s'il commence par `https://`. Cela évite d'afficher plus tard un lien `javascript:`.
  - `LetterboxdCsvError` est levée pour un fichier vide ou sans colonne `Name`.
  - Le module est pur, sans import serveur : il est importé côté client.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { describe, expect, it } from "vitest";
import { LetterboxdCsvError, parseLetterboxdCsv } from "./parseLetterboxdCsv";

describe("parseLetterboxdCsv", () => {
  it("lit les lignes d'une watchlist Letterboxd", () => {
    const csv = "Date,Name,Year,Letterboxd URI\n2024-03-05,Inception,2010,https://boxd.it/1skk\n";
    expect(parseLetterboxdCsv(csv)).toEqual({
      entries: [{ name: "Inception", year: 2010, addedAt: "2024-03-05", letterboxdUri: "https://boxd.it/1skk" }],
      skipped: 0,
    });
  });

  it("gère guillemets, virgules et guillemets doublés, BOM et fins de ligne CRLF", () => {
    const csv =
      '\uFEFFDate,Name,Year,Letterboxd URI\r\n' +
      '2024-01-02,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/a\r\n' +
      '2024-01-03,"The ""Burbs""",1989,https://boxd.it/b\r\n';
    expect(parseLetterboxdCsv(csv).entries.map((e) => e.name)).toEqual(["Crouching Tiger, Hidden Dragon", 'The "Burbs"']);
  });

  it("repère les colonnes par leur nom, quel que soit leur ordre", () => {
    const csv = "Name,Letterboxd URI,Year,Date\nHeat,https://boxd.it/c,1995,2023-12-31\n";
    expect(parseLetterboxdCsv(csv).entries).toEqual([
      { name: "Heat", year: 1995, addedAt: "2023-12-31", letterboxdUri: "https://boxd.it/c" },
    ]);
  });

  it("accepte une année ou une date absente ou invalide, et un lien non https", () => {
    const csv = "Date,Name,Year,Letterboxd URI\n,Sans année,,javascript:alert(1)\nhier,Autre,19xx,\n";
    expect(parseLetterboxdCsv(csv).entries).toEqual([
      { name: "Sans année", year: null, addedAt: null, letterboxdUri: null },
      { name: "Autre", year: null, addedAt: null, letterboxdUri: null },
    ]);
  });

  it("ignore et compte les lignes sans titre ou au titre trop long, sans compter les lignes vides", () => {
    const csv = `Date,Name,Year,Letterboxd URI\n2024-01-01,,2010,\n\n2024-01-01,${"x".repeat(301)},2010,\n2024-01-01,Ok,2010,\n`;
    const result = parseLetterboxdCsv(csv);
    expect(result.entries.map((e) => e.name)).toEqual(["Ok"]);
    expect(result.skipped).toBe(2);
  });

  it("refuse un fichier vide ou sans colonne Name", () => {
    expect(() => parseLetterboxdCsv("")).toThrow(LetterboxdCsvError);
    expect(() => parseLetterboxdCsv("Date,Title,Year\n2024-01-01,Heat,1995\n")).toThrow(LetterboxdCsvError);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `npx vitest run src/application/import/parseLetterboxdCsv.test.ts`.
Résultat attendu : ÉCHEC, le module est introuvable.

- [ ] **Étape 3 : implémenter**

```ts
// Lecture de watchlist.csv, exporté de Letterboxd (Settings → Import & Export → Export your data).
// En-tête attendu : Date,Name,Year,Letterboxd URI (colonnes repérées par leur nom).
// Fonction pure, utilisée aussi dans le navigateur.

export type LetterboxdEntry = {
  name: string;
  year: number | null;
  // AAAA-MM-JJ : date d'ajout dans la watchlist Letterboxd.
  addedAt: string | null;
  letterboxdUri: string | null;
};

export const MAX_NAME_LENGTH = 300;

export class LetterboxdCsvError extends Error {}

// Découpe un CSV (RFC 4180) en lignes de champs : guillemets, virgules et guillemets doublés, CRLF ou LF.
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseLetterboxdCsv(text: string): { entries: LetterboxdEntry[]; skipped: number } {
  const rows = parseRows(text.replace(/^\uFEFF/, ""));
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const column = (name: string) => header.indexOf(name);
  const nameCol = column("name");
  if (nameCol === -1) throw new LetterboxdCsvError("Fichier non reconnu : colonne « Name » absente.");
  const yearCol = column("year");
  const dateCol = column("date");
  const uriCol = column("letterboxd uri");

  const entries: LetterboxdEntry[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === "")) continue;
    const cell = (index: number) => (index === -1 ? "" : (row[index] ?? "").trim());
    const name = cell(nameCol);
    if (!name || name.length > MAX_NAME_LENGTH) {
      skipped++;
      continue;
    }
    const year = /^\d{4}$/.test(cell(yearCol)) ? Number(cell(yearCol)) : null;
    const addedAt = /^\d{4}-\d{2}-\d{2}$/.test(cell(dateCol)) ? cell(dateCol) : null;
    const uri = cell(uriCol);
    entries.push({ name, year, addedAt, letterboxdUri: uri.startsWith("https://") ? uri : null });
  }
  return { entries, skipped };
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer `npx vitest run src/application/import/parseLetterboxdCsv.test.ts`. Résultat attendu : RÉUSSITE, 6 tests.

- [ ] **Étape 5 : commiter**

```bash
git add src/application/import/parseLetterboxdCsv.ts src/application/import/parseLetterboxdCsv.test.ts
git commit -F - <<'EOF'
feat: lecture du CSV de la watchlist Letterboxd

parseLetterboxdCsv, fonction pure (utilisable dans le navigateur) :
découpage RFC 4180 (guillemets, virgules et guillemets doublés, BOM,
CRLF), colonnes repérées par leur nom (Date, Name, Year, Letterboxd URI).
Année sur 4 chiffres, date AAAA-MM-JJ et lien https seulement, sinon
null. Lignes sans titre ou de plus de 300 caractères ignorées et
comptées ; fichier sans colonne Name refusé (LetterboxdCsvError).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 4 : correspondance entre un film Letterboxd et les résultats JustWatch

**Fichiers :**
- Créer `src/application/import/matchLetterboxd.ts`
- Test : `src/application/import/matchLetterboxd.test.ts`

**Interfaces :**
- Consomme : `LetterboxdEntry` (tâche 3) et `Title` avec `originalTitle?` (tâche 1).
- Produit :
  ```ts
  export const MAX_CANDIDATES = 5;
  export type Match = { kind: "sure"; title: Title } | { kind: "ambiguous"; candidates: Title[] } | { kind: "notFound" };
  export function normalizeTitle(title: string): string;
  export function classify(entry: Pick<LetterboxdEntry, "name" | "year">, results: Title[]): Match;
  ```

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { describe, expect, it } from "vitest";
import type { Title } from "@/domain/Title";
import { classify, normalizeTitle } from "./matchLetterboxd";

const movie = (id: string, name: string, year: number | null, originalTitle: string | null = null): Title => ({
  id,
  type: "MOVIE",
  name,
  originalTitle,
  year,
  posterUrl: null,
  imdbId: null,
  tmdbId: null,
});

describe("normalizeTitle", () => {
  it("ignore casse, accents, ponctuation et article initial", () => {
    expect(normalizeTitle("The Dark Knight")).toBe("dark knight");
    expect(normalizeTitle("Amélie")).toBe("amelie");
    expect(normalizeTitle("L'Été meurtrier")).toBe("ete meurtrier");
    expect(normalizeTitle("Les Évadés")).toBe("evades");
    expect(normalizeTitle("Mission: Impossible – Fallout")).toBe("mission impossible fallout");
  });

  it("garde les lettres non latines", () => {
    expect(normalizeTitle("千と千尋の神隠し")).toBe("千と千尋の神隠し");
  });
});

describe("classify", () => {
  it("est sûr quand un seul film a le même titre et une année à ±1 an", () => {
    const results = [movie("tm1", "Heat", 1995), movie("tm2", "Heat", 1986)];
    expect(classify({ name: "Heat", year: 1996 }, results)).toEqual({ kind: "sure", title: results[0] });
  });

  it("compare aussi au titre original", () => {
    const shawshank = movie("tm3", "Les Évadés", 1994, "The Shawshank Redemption");
    expect(classify({ name: "The Shawshank Redemption", year: 1994 }, [shawshank])).toEqual({
      kind: "sure",
      title: shawshank,
    });
  });

  it("ignore les séries", () => {
    const show: Title = { ...movie("ts1", "Heat", 1995), type: "SHOW" };
    expect(classify({ name: "Heat", year: 1995 }, [show])).toEqual({ kind: "notFound" });
  });

  it("est à valider quand plusieurs films ont le même titre et une année compatible", () => {
    const results = [movie("tm1", "Dune", 2021), movie("tm2", "Dune", 2021)];
    expect(classify({ name: "Dune", year: 2021 }, results)).toEqual({ kind: "ambiguous", candidates: results });
  });

  it("est à valider quand aucun titre ne correspond mais qu'une année est compatible, avec 5 candidats au plus", () => {
    const results = Array.from({ length: 7 }, (_, i) => movie(`tm${i}`, `Autre ${i}`, 2001));
    expect(classify({ name: "Spirited Away", year: 2001 }, results)).toEqual({
      kind: "ambiguous",
      candidates: results.slice(0, 5),
    });
  });

  it("est introuvable sans film d'année compatible", () => {
    expect(classify({ name: "Heat", year: 1995 }, [movie("tm1", "Heat", 2010), movie("tm2", "Heat", null)])).toEqual({
      kind: "notFound",
    });
  });

  it("accepte toutes les années quand l'année Letterboxd est absente", () => {
    const results = [movie("tm1", "Heat", 1995)];
    expect(classify({ name: "Heat", year: null }, results)).toEqual({ kind: "sure", title: results[0] });
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `npx vitest run src/application/import/matchLetterboxd.test.ts`.
Résultat attendu : ÉCHEC, le module est introuvable.

- [ ] **Étape 3 : implémenter**

```ts
// Correspondance entre un film de la watchlist Letterboxd (titre + année) et les résultats de recherche JustWatch.

import type { Title } from "@/domain/Title";
import type { LetterboxdEntry } from "./parseLetterboxdCsv";

export const MAX_CANDIDATES = 5;
// Écart d'années toléré (dates de sortie différentes selon les pays).
const YEAR_TOLERANCE = 1;

export type Match = { kind: "sure"; title: Title } | { kind: "ambiguous"; candidates: Title[] } | { kind: "notFound" };

// Minuscules, sans accents ni ponctuation, sans article initial : « L'Été meurtrier » → « ete meurtrier ».
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^l'/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(the|a|an|le|la|les) /, "");
}

export function classify(entry: Pick<LetterboxdEntry, "name" | "year">, results: Title[]): Match {
  const compatible = results.filter(
    (t) => t.type === "MOVIE" && (entry.year === null || (t.year !== null && Math.abs(t.year - entry.year) <= YEAR_TOLERANCE)),
  );
  if (compatible.length === 0) return { kind: "notFound" };
  const target = normalizeTitle(entry.name);
  const sameTitle = compatible.filter(
    (t) => normalizeTitle(t.name) === target || (!!t.originalTitle && normalizeTitle(t.originalTitle) === target),
  );
  if (sameTitle.length === 1) return { kind: "sure", title: sameTitle[0] };
  return { kind: "ambiguous", candidates: (sameTitle.length > 1 ? sameTitle : compatible).slice(0, MAX_CANDIDATES) };
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer `npx vitest run src/application/import/matchLetterboxd.test.ts`. Résultat attendu : RÉUSSITE, 9 tests.

- [ ] **Étape 5 : commiter**

```bash
git add src/application/import/matchLetterboxd.ts src/application/import/matchLetterboxd.test.ts
git commit -F - <<'EOF'
feat: correspondance entre films Letterboxd et résultats JustWatch

normalizeTitle (casse, accents, ponctuation, article initial ; lettres
non latines conservées) et classify : films seulement, année à ±1 an
(toutes si l'année Letterboxd manque), titre ou titre original
identique. Un seul film → sûr ; plusieurs, ou aucun titre identique mais
une année compatible → à valider (5 candidats au plus) ; sinon
introuvable.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 5 : cas d'usage `ImportLetterboxd`

**Fichiers :**
- Créer `src/application/import/ImportLetterboxd.ts`
- Test : `src/application/import/ImportLetterboxd.test.ts`

**Interfaces :**
- Consomme :
  - `CatalogProvider.searchTitles(query): Promise<Title[]>` et `CatalogUnavailableError` (`@/domain/ports/CatalogProvider`) ;
  - `Watchlist.get(titleId)`, `Watchlist.add(titleId, { addedAt? })` (tâche 2) et `TitleNotFoundError` (`@/application/watchlist/Watchlist`) ;
  - `classify` (tâche 4) et `LetterboxdEntry` (tâche 3).
- Produit :
  ```ts
  export const MAX_BATCH = 5;
  export type ImportResult = { entry: LetterboxdEntry } & (
    | { status: "added"; title: Title }
    | { status: "alreadyInList"; title: Title }
    | { status: "ambiguous"; candidates: Title[] }
    | { status: "notFound" }
  );
  export class ImportLetterboxd {
    constructor(catalog: CatalogProvider, watchlist: Watchlist, sleep?: (ms: number) => Promise<void>, pauseMs?: number);
    importEntries(entries: LetterboxdEntry[]): Promise<{ results: ImportResult[]; remaining: LetterboxdEntry[] }>;
    resolve(titleId: string, addedAt: string | null): Promise<WatchlistItem>;
  }
  ```
  - La présence d'un titre se vérifie avec `Watchlist.get`. Le `WatchlistRepository` mentionné dans la spec n'est pas utile.
  - `addedAt` au format `AAAA-MM-JJ` devient `new Date("AAAA-MM-JJT12:00:00Z")` : midi UTC, pour rester sur le bon jour à Paris.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { describe, expect, it } from "vitest";
import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { Title } from "@/domain/Title";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "@/application/watchlist/Watchlist";
import { ImportLetterboxd } from "./ImportLetterboxd";
import type { LetterboxdEntry } from "./parseLetterboxdCsv";

const movie = (id: string, name: string, year: number): Title => ({
  id,
  type: "MOVIE",
  name,
  originalTitle: null,
  year,
  posterUrl: null,
  imdbId: null,
  tmdbId: null,
});
const entry = (name: string, year: number, addedAt: string | null = "2024-03-05"): LetterboxdEntry => ({
  name,
  year,
  addedAt,
  letterboxdUri: null,
});

function setup(search: (query: string) => Title[] | Error, existing: string[] = []) {
  const added: { titleId: string; addedAt?: Date }[] = [];
  const sleeps: number[] = [];
  const catalog = {
    searchTitles: async (query: string) => {
      const result = search(query);
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as CatalogProvider;
  const watchlist = {
    get: async (id: string) => (existing.includes(id) ? ({ title: { id } } as WatchlistItem) : null),
    add: async (titleId: string, options: { addedAt?: Date } = {}) => {
      added.push({ titleId, addedAt: options.addedAt });
      return { title: movie(titleId, titleId, 2000), details: null, note: "", addedAt: options.addedAt ?? new Date() };
    },
  } as unknown as Watchlist;
  const importer = new ImportLetterboxd(catalog, watchlist, async (ms) => void sleeps.push(ms), 1000);
  return { importer, added, sleeps };
}

describe("ImportLetterboxd", () => {
  it("ajoute un film sûr avec sa date Letterboxd, en pause entre deux films", async () => {
    const { importer, added, sleeps } = setup((q) => (q === "Heat" ? [movie("tm1", "Heat", 1995)] : []));
    const { results, remaining } = await importer.importEntries([entry("Heat", 1995), entry("Inconnu", 1990)]);
    expect(results.map((r) => r.status)).toEqual(["added", "notFound"]);
    expect(added).toEqual([{ titleId: "tm1", addedAt: new Date("2024-03-05T12:00:00Z") }]);
    expect(sleeps).toEqual([1000]);
    expect(remaining).toEqual([]);
  });

  it("ne touche pas à un film déjà dans la liste", async () => {
    const { importer, added } = setup(() => [movie("tm1", "Heat", 1995)], ["tm1"]);
    const { results } = await importer.importEntries([entry("Heat", 1995)]);
    expect(results[0]).toMatchObject({ status: "alreadyInList", title: { id: "tm1" } });
    expect(added).toEqual([]);
  });

  it("renvoie les candidats d'un film douteux sans l'ajouter", async () => {
    const candidates = [movie("tm1", "Dune", 2021), movie("tm2", "Dune", 2021)];
    const { importer, added } = setup(() => candidates);
    const { results } = await importer.importEntries([entry("Dune", 2021)]);
    expect(results[0]).toEqual({ entry: entry("Dune", 2021), status: "ambiguous", candidates });
    expect(added).toEqual([]);
  });

  it("s'arrête si le catalogue est indisponible et renvoie les films restants", async () => {
    const { importer } = setup((q) => (q === "B" ? new CatalogUnavailableError("429") : [movie("tm1", "A", 2000)]));
    const entries = [entry("A", 2000), entry("B", 2000), entry("C", 2000)];
    const { results, remaining } = await importer.importEntries(entries);
    expect(results.map((r) => r.status)).toEqual(["added"]);
    expect(remaining).toEqual(entries.slice(1));
  });

  it("ajoute le candidat choisi avec la date Letterboxd, ou maintenant sans date", async () => {
    const { importer, added } = setup(() => []);
    await importer.resolve("tm9", "2023-12-31");
    await importer.resolve("tm8", null);
    expect(added).toEqual([
      { titleId: "tm9", addedAt: new Date("2023-12-31T12:00:00Z") },
      { titleId: "tm8", addedAt: undefined },
    ]);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer `npx vitest run src/application/import/ImportLetterboxd.test.ts`.
Résultat attendu : ÉCHEC, le module est introuvable.

- [ ] **Étape 3 : implémenter**

```ts
// Import de la watchlist Letterboxd, un lot à la fois (le navigateur envoie les films par lots de MAX_BATCH).
// Pas de vérification des offres ici : le badge « disponible chez moi » se remplit à l'affichage de la liste
// et par le cron quotidien, pour rester raisonnable avec JustWatch.

import { TitleNotFoundError, type Watchlist } from "@/application/watchlist/Watchlist";
import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { Title } from "@/domain/Title";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import { classify } from "./matchLetterboxd";
import type { LetterboxdEntry } from "./parseLetterboxdCsv";

export const MAX_BATCH = 5;

export type ImportResult = { entry: LetterboxdEntry } & (
  | { status: "added"; title: Title }
  | { status: "alreadyInList"; title: Title }
  | { status: "ambiguous"; candidates: Title[] }
  | { status: "notFound" }
);

// « 2024-03-05 » → midi UTC, pour rester sur le bon jour calendaire à Paris.
function toDate(addedAt: string | null): Date | undefined {
  return addedAt ? new Date(`${addedAt}T12:00:00Z`) : undefined;
}

export class ImportLetterboxd {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly watchlist: Watchlist,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // Pause entre deux films, pour ménager JustWatch.
    private readonly pauseMs = 1000,
  ) {}

  // S'arrête au premier refus du catalogue : les films non traités sont renvoyés dans `remaining`.
  async importEntries(entries: LetterboxdEntry[]): Promise<{ results: ImportResult[]; remaining: LetterboxdEntry[] }> {
    const results: ImportResult[] = [];
    for (const [index, entry] of entries.entries()) {
      if (index > 0) await this.sleep(this.pauseMs);
      try {
        results.push(await this.importEntry(entry));
      } catch (error) {
        if (error instanceof CatalogUnavailableError) return { results, remaining: entries.slice(index) };
        throw error;
      }
    }
    return { results, remaining: [] };
  }

  resolve(titleId: string, addedAt: string | null): Promise<WatchlistItem> {
    return this.watchlist.add(titleId, { addedAt: toDate(addedAt) });
  }

  private async importEntry(entry: LetterboxdEntry): Promise<ImportResult> {
    const match = classify(entry, await this.catalog.searchTitles(entry.name));
    if (match.kind === "notFound") return { entry, status: "notFound" };
    if (match.kind === "ambiguous") return { entry, status: "ambiguous", candidates: match.candidates };
    if (await this.watchlist.get(match.title.id)) return { entry, status: "alreadyInList", title: match.title };
    try {
      const item = await this.watchlist.add(match.title.id, { addedAt: toDate(entry.addedAt) });
      return { entry, status: "added", title: item.title };
    } catch (error) {
      if (error instanceof TitleNotFoundError) return { entry, status: "notFound" };
      throw error;
    }
  }
}
```

- [ ] **Étape 4 : vérifier que tout passe**

Lancer `npm test`. Résultat attendu : tous les tests passent.

- [ ] **Étape 5 : commiter**

```bash
git add src/application/import/ImportLetterboxd.ts src/application/import/ImportLetterboxd.test.ts
git commit -F - <<'EOF'
feat: cas d'usage d'import de la watchlist Letterboxd

ImportLetterboxd.importEntries traite un lot (5 films au plus côté
route) : recherche JustWatch, classement, ajout des films sûrs avec leur
date Letterboxd (midi UTC), films déjà présents laissés tels quels,
candidats renvoyés pour les cas douteux. Pause de 1 s entre deux films,
arrêt sur CatalogUnavailableError avec les films restants. resolve
ajoute le candidat choisi par l'utilisateur. Pas de vérification des
offres pendant l'import.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 6 : route API et assemblage

**Fichiers :**
- Modifier `src/infrastructure/container.ts`
- Créer `src/app/api/watchlist/import/route.ts`

Aucun test unitaire pour cette tâche : les routes du dépôt n'en ont pas. Le comportement de la route est vérifié de bout en bout à la tâche 8.

**Interfaces :**
- Consomme `ImportLetterboxd` et `MAX_BATCH` (tâche 5), `MAX_NAME_LENGTH` et `LetterboxdEntry` (tâche 3), et `apiErrorResponse` (`src/app/api/apiErrors.ts`).
- Produit, à l'usage du front-end :
  - `POST /api/watchlist/import { entries: LetterboxdEntry[] }` (1 à 5 entrées) → 200 `{ results: ImportResult[], remaining: LetterboxdEntry[] }` ;
  - `POST /api/watchlist/import { resolve: { titleId: string, addedAt: string | null } }` → 201 `{ item }` ;
  - erreurs : 400 `{ error: "invalid_import" }` ; 404 `not_found` si le titre est inconnu ; 503 `catalog_unavailable` si `resolve` échoue côté catalogue.

- [ ] **Étape 1 : assembler**

Dans `src/infrastructure/container.ts` :
- ajouter l'import `import { ImportLetterboxd } from "@/application/import/ImportLetterboxd";` ;
- ajouter cette ligne après `export const watchlist = …` :

```ts
export const importLetterboxd = new ImportLetterboxd(catalog, watchlist);
```

- [ ] **Étape 2 : écrire la route**

```ts
// POST /api/watchlist/import { entries: LetterboxdEntry[] }           → { results, remaining } (MAX_BATCH films au plus)
// POST /api/watchlist/import { resolve: { titleId, addedAt } }        → 201 { item } (candidat choisi par l'utilisateur)
// Si JustWatch refuse en cours de lot, la réponse reste 200 : `remaining` contient les films non traités.

import { NextRequest, NextResponse } from "next/server";
import { MAX_BATCH } from "@/application/import/ImportLetterboxd";
import { MAX_NAME_LENGTH, type LetterboxdEntry } from "@/application/import/parseLetterboxdCsv";
import { importLetterboxd } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";
// 5 films × (recherche + fiche + pause de 1 s) : largement moins d'une minute.
export const maxDuration = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && DATE.test(value) ? value : undefined;
}

function parseEntry(value: unknown): LetterboxdEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, year, addedAt, letterboxdUri } = value as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LENGTH) return null;
  if (year !== null && !(Number.isInteger(year) && (year as number) > 1800 && (year as number) < 3000)) return null;
  const date = parseDate(addedAt);
  if (date === undefined) return null;
  const uri = typeof letterboxdUri === "string" && letterboxdUri.startsWith("https://") ? letterboxdUri : null;
  return { name: name.trim(), year: year as number | null, addedAt: date, letterboxdUri: uri };
}

const invalid = () => NextResponse.json({ error: "invalid_import" }, { status: 400 });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  try {
    if (body?.resolve) {
      const titleId = typeof body.resolve.titleId === "string" ? body.resolve.titleId : "";
      const addedAt = parseDate(body.resolve.addedAt);
      if (!titleId || addedAt === undefined) return invalid();
      return NextResponse.json({ item: await importLetterboxd.resolve(titleId, addedAt) }, { status: 201 });
    }
    if (!Array.isArray(body?.entries) || body.entries.length === 0 || body.entries.length > MAX_BATCH) return invalid();
    const entries = body.entries.map(parseEntry);
    if (entries.some((e: LetterboxdEntry | null) => e === null)) return invalid();
    return NextResponse.json(await importLetterboxd.importEntries(entries as LetterboxdEntry[]));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
```

- [ ] **Étape 3 : vérifier les types et le build**

Lancer `npx tsc --noEmit && npm run build`.
Résultat attendu : aucune erreur, et la route `/api/watchlist/import` apparaît dans la liste du build (ƒ).

- [ ] **Étape 4 : vérifier que tous les tests passent**

Lancer `npm test`. Résultat attendu : tous les tests passent.

- [ ] **Étape 5 : commiter**

```bash
git add src/infrastructure/container.ts src/app/api/watchlist/import/route.ts
git commit -F - <<'EOF'
feat: route POST /api/watchlist/import

- { entries } : lot de 1 à 5 films Letterboxd, validés (titre de 300
  caractères au plus, année entière ou null, date AAAA-MM-JJ ou null,
  lien https seulement) → { results, remaining }. Un refus de JustWatch
  en cours de lot renvoie les films non traités dans remaining.
- { resolve: { titleId, addedAt } } : ajoute le candidat choisi → 201.
- 400 invalid_import pour une requête mal formée ; erreurs des cas
  d'usage via apiErrorResponse. maxDuration de 60 s.
- container : instance importLetterboxd.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push
```

---

### Tâche 7 : interface d'import (front-end, déléguée à Sonnet)

**Fichiers :**
- Créer `src/app/liste/import/page.tsx`
- Créer `src/app/components/LetterboxdImport.tsx`
- Modifier `src/app/components/WatchlistView.tsx` : bouton d'accès
- Modifier `src/app/globals.css`

**Interfaces :**
- Consomme :
  - `parseLetterboxdCsv`, `LetterboxdCsvError` et `LetterboxdEntry` (`@/application/import/parseLetterboxdCsv`) ;
  - le type `ImportResult` et `MAX_BATCH` (`@/application/import/ImportLetterboxd`), en **import de type seulement** (`import type`) pour `ImportResult`. `MAX_BATCH` peut être recopié en constante locale `5`, pour ne pas embarquer de code serveur côté client ;
  - les routes de la tâche 6 ;
  - `apiFetch` (`src/app/components/apiFetch.ts`), comme les autres composants.

**Consigne pour le sous-agent Sonnet :** lire la spec (section Front-end) et `globals.css`, et reprendre les composants de la refonte : `.card`, `button.primary`, `button.ghost`, `.badge-sub`, champ de fichier, barre de progression ambre comme dans `TitleView`. Vérifier par grep qu'une classe n'existe pas avant de l'ajouter.

- [ ] **Étape 1 : bouton d'accès dans « Ma liste »**

Dans l'en-tête de `WatchlistView` (ligne du h1 « Ma liste »), ajouter un lien `<Link href="/liste/import" className="button-link">`, avec l'icône `ArrowUpTrayIcon` de `@heroicons/react/24/outline` et le texte « Importer depuis Letterboxd ». Il a l'aspect d'un bouton à bordure, fait 44 px de haut au minimum, et passe sous le titre sur mobile.

- [ ] **Étape 2 : page `src/app/liste/import/page.tsx`**

C'est un composant serveur :
- `<main className="container page">` ;
- un lien « ← Ma liste » avec `ArrowLeftIcon` ;
- un h1 « Importer depuis Letterboxd » ;
- `<LetterboxdImport />`.

- [ ] **Étape 3 : composant `LetterboxdImport.tsx` (`"use client"`)**

**États :**
- `entries` : le fichier lu ;
- `skipped` ;
- `queue` : les films pas encore envoyés ;
- `results` : un tableau de `ImportResult` ;
- `running` ;
- `stopped` : `"user" | "catalog" | "network" | null` ;
- `resolved` : une table `entry.letterboxdUri ?? entry.name` → `"added" | "dismissed"`.

**Boucle d'import**, logique à respecter :

```ts
async function run(start: LetterboxdEntry[]) {
  setRunning(true);
  setStopped(null);
  let pending = start;
  while (pending.length > 0 && !stopRef.current) {
    const batch = pending.slice(0, 5);
    let response: Response;
    try {
      response = await apiFetch("/api/watchlist/import", undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: batch }),
      });
    } catch {
      setStopped("network");
      break;
    }
    if (!response.ok) {
      setStopped(response.status === 503 ? "catalog" : "network");
      break;
    }
    const body = (await response.json()) as { results: ImportResult[]; remaining: LetterboxdEntry[] };
    setResults((r) => [...r, ...body.results]);
    pending = [...body.remaining, ...pending.slice(batch.length)];
    setQueue(pending);
    if (body.remaining.length > 0) {
      setStopped("catalog");
      break;
    }
  }
  if (stopRef.current) setStopped("user");
  setRunning(false);
}
```

Adapter l'appel à la signature réelle d'`apiFetch`, après l'avoir lue. Il redirige vers `/login` sur un 401. `stopRef` est un `useRef(false)` passé à `true` par « Arrêter ».

**Rendu :**
- **Étape 1, le fichier**, dans une carte :
  - le mode d'emploi en 3 points : Letterboxd → Settings → Import & Export → Export your data ; décompresser le ZIP ; choisir `watchlist.csv` ;
  - un `<input type="file" accept=".csv,text/csv">` habillé en zone de dépôt, qui accepte aussi le glisser-déposer ;
  - la lecture se fait avec `file.text()` puis `parseLetterboxdCsv` ;
  - en cas de `LetterboxdCsvError`, le message en `--danger` ;
  - en cas de succès, « N films trouvés · M lignes ignorées » et un bouton primaire « Lancer l'import », désactivé si N vaut 0.
- **Étape 2, la progression** :
  - « x / N films traités » et une barre ambre ;
  - quatre compteurs en pastilles : Ajoutés, Déjà dans ma liste, À valider, Introuvables ;
  - pendant l'import, un bouton « Arrêter » ;
  - si l'import est arrêté (`stopped` ≠ null) et que `queue` n'est pas vide : « N films non traités » (avec en plus « JustWatch limite les requêtes, réessayez dans quelques minutes » si `stopped === "catalog"`) et un bouton « Reprendre », qui appelle `run(queue)`.
- **Étape 3, à valider**, pour chaque résultat `ambiguous` non résolu :
  - une carte avec « Name (Year) » de Letterboxd ;
  - une grille de candidats (affiche de 64 px ou emplacement vide, titre, année) ;
  - chaque candidat est un `<button>` qui appelle `POST { resolve: { titleId, addedAt: entry.addedAt } }`. En cas de succès, le film passe à `"added"` et le compteur « Ajoutés » augmente. En cas d'erreur, un message s'affiche dans la carte ;
  - un bouton fantôme « Aucun » fait passer le film à `"dismissed"`.
- **Récapitulatif**, quand `queue` est vide et que l'import ne tourne plus :
  - « N films ajoutés à ma liste » et un lien vers `/liste` ;
  - la liste des introuvables. Pour chacun : « Chercher dans GeoWatch », un lien vers `/?q=<Name encodé>` (voir l'étape 4), et « Voir sur Letterboxd » (`letterboxdUri`, `target="_blank" rel="noopener noreferrer"`), seulement si `letterboxdUri` n'est pas null.
- **Accessibilité** :
  - la progression dans une région `aria-live="polite"` ;
  - des boutons de 44 px au minimum ;
  - un `alt` sur chaque affiche (« Affiche de … »).

- [ ] **Étape 4 : recherche préremplie sur l'accueil**

Lire `SearchBox.tsx`. S'il ne lit pas encore `?q=` dans l'URL, ajouter cette lecture au chargement, avec `useSearchParams` de `next/navigation`, pour préremplir la recherche et la lancer. La page d'accueil doit alors entourer `SearchBox` d'un `<Suspense>`, exigé par Next 15 pour `useSearchParams`. Si cette lecture existe déjà, ne rien faire.

- [ ] **Étape 5 : vérifier**

Lancer `npx tsc --noEmit && npm run build && npm test`.
Résultat attendu : aucune erreur, la page `/liste/import` apparaît dans le build et tous les tests passent.

- [ ] **Étape 6 : relecture par l'agent principal, puis commit**

Relecture :
- aucune classe CSS en double ;
- aucun import serveur côté client (`container`, `mongodb`). À vérifier en lançant `grep -n "infrastructure" src/app/components/LetterboxdImport.tsx`, qui ne doit rien afficher.

Puis :

```bash
git add src/app/liste/import/page.tsx src/app/components/LetterboxdImport.tsx src/app/components/WatchlistView.tsx src/app/components/SearchBox.tsx src/app/page.tsx src/app/globals.css
git commit -F - <<'EOF'
feat: page d'import de la watchlist Letterboxd

- « Ma liste » : bouton « Importer depuis Letterboxd » vers /liste/import.
- Étape fichier : mode d'emploi de l'export, zone de dépôt de
  watchlist.csv, lecture dans le navigateur (parseLetterboxdCsv), nombre
  de films et de lignes ignorées.
- Import par lots de 5 : barre de progression, compteurs (ajoutés, déjà
  présents, à valider, introuvables), Arrêter / Reprendre, message si
  JustWatch limite les requêtes.
- Validation des cas douteux : candidats en cartes, choix ajouté avec la
  date Letterboxd, « Aucun » pour écarter.
- Récapitulatif : films ajoutés, introuvables avec recherche GeoWatch
  préremplie (?q= sur l'accueil) et lien Letterboxd.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push
```

Si l'étape 4 n'a rien changé, retirer `SearchBox.tsx` et `page.tsx` du `git add`.

---

### Tâche 8 : vérification de bout en bout, backlog et PR

**Fichiers :**
- Créer un script de test hors du dépôt : `C:\Users\chris\AppData\Local\Temp\claude\f--Dev-GeoWatch\e6f1fdf7-d033-4fe3-8174-91442f1ea83a\scratchpad\import.mjs`
- Modifier `BACKLOG.md`

- [ ] **Étape 1 : script de bout en bout**

Il suit le modèle de `scratchpad/cards.mjs` : `next start -p 3131`, Mongo en mémoire, connexion avec `APP_PASSWORD: "motdepasse-test"`. Il fait les appels réels à JustWatch, environ 10 requêtes.

```js
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("F:/Dev/GeoWatch/package.json");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongo = await MongoMemoryServer.create();
const env = { ...process.env, MONGODB_URI: mongo.getUri(), APP_PASSWORD: "motdepasse-test", SESSION_SECRET: "x".repeat(40) };
const server = spawn("npx next start -p 3131", { cwd: "F:/Dev/GeoWatch", env, shell: true });
const stop = () => spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true });
setTimeout(() => { console.log("TIMEOUT"); stop(); process.exit(1); }, 180000);
const base = "http://localhost:3131";
for (let i = 0; i < 30; i++) { try { await fetch(base + "/login"); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "motdepasse-test" }) });
const h = { cookie: login.headers.get("set-cookie")?.split(";")[0], "Content-Type": "application/json" };
const post = (body) => fetch(base + "/api/watchlist/import", { method: "POST", headers: h, body: JSON.stringify(body) });
try {
  const entries = [
    { name: "The Shawshank Redemption", year: 1994, addedAt: "2024-01-02", letterboxdUri: "https://boxd.it/2aHi" },
    { name: "Heat", year: 1995, addedAt: "2024-01-03", letterboxdUri: null },
    { name: "Dune", year: 2021, addedAt: null, letterboxdUri: null },
    { name: "Zzzz film inexistant", year: 1990, addedAt: null, letterboxdUri: null },
  ];
  const r1 = await post({ entries });
  const b1 = await r1.json();
  console.log("lot", r1.status, JSON.stringify(b1.results.map((r) => [r.entry.name, r.status, r.title?.id ?? r.candidates?.map((c) => c.id)])), "reste", b1.remaining.length);
  const r2 = await post({ entries: entries.slice(0, 1) });
  console.log("ré-import", (await r2.json()).results[0].status);
  console.log("invalide", (await post({ entries: [] })).status, (await post({ entries: Array(6).fill(entries[1]) })).status);
  const list = await (await fetch(base + "/api/watchlist", { headers: h })).json();
  console.log("liste", JSON.stringify(list.items.map((i) => [i.title.name, i.addedAt])));
  console.log("/liste/import", (await fetch(base + "/liste/import", { headers: h })).status);
} finally { stop(); await mongo.stop(); }
process.exit(0);
```

- [ ] **Étape 2 : lancer le script**

Lancer `npm run build`, puis `node C:\Users\chris\AppData\Local\Temp\claude\f--Dev-GeoWatch\e6f1fdf7-d033-4fe3-8174-91442f1ea83a\scratchpad\import.mjs`.

Résultat attendu :
- « The Shawshank Redemption » est `added`, grâce au titre original ; c'est le test clé de la tâche 1 ;
- « Heat » est `added` ;
- « Dune » est `ambiguous` ou `added`, selon les résultats de JustWatch ;
- le film inexistant est `notFound` ;
- « reste 0 » ;
- le ré-import donne `alreadyInList` ;
- les requêtes invalides donnent `400 400` ;
- la liste montre les dates `2024-01-02T12:00:00.000Z` et `2024-01-03T12:00:00.000Z` ;
- `/liste/import` répond 200.

Si le serveur reste actif, retrouver son PID avec `netstat -ano | grep :3131` et l'arrêter avec `Stop-Process -Id <pid>`.

- [ ] **Étape 3 : retirer l'idée du backlog**

Dans `BACKLOG.md`, supprimer la ligne « **Import de la watchlist Letterboxd** … ».

```bash
git add BACKLOG.md
git commit -F - <<'EOF'
docs: retirer l'import Letterboxd du backlog

L'import de la watchlist Letterboxd est implémenté dans cette branche.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push
```

- [ ] **Étape 4 : ouvrir la PR vers `main`**

```bash
gh pr create --base main --head feat/import-letterboxd --title "feat: import de la watchlist Letterboxd" --body-file <récap>
```

Le corps de la PR, en français, contient :
- le fonctionnement, en reprenant la spec ;
- la liste des commits ;
- les vérifications : tests, build et résultat du script de bout en bout ;
- ce qui reste à tester sur la prévisualisation ;
- la ligne `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Étape 5 : contrôler la prévisualisation**

Attendre le déploiement avec `vercel ls geowatch -m githubCommitRef=feat/import-letterboxd`, jusqu'à l'état Ready. Lancer ensuite :

```
MSYS_NO_PATHCONV=1 vercel curl /api/watchlist/import --deployment <url> -- -s -o /dev/null -w "%{http_code}\n" -X POST
```

Résultat attendu : `401`, puisqu'il n'y a pas de session. Donner ensuite à l'utilisateur le lien de la prévisualisation et ce qu'il doit tester avec son vrai `watchlist.csv`.
