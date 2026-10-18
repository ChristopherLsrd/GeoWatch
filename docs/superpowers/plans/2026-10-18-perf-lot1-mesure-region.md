# Lot 1 : mesure Server-Timing et région cdg1 — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** mesurer le temps Mongo, JustWatch et total des routes lentes avec un en-tête `Server-Timing`, puis rapprocher les fonctions Vercel du cluster Atlas (Paris, `cdg1`).

**Architecture :**
- Un module d'infrastructure `src/infrastructure/timing/requestTiming.ts` accumule des durées par requête dans un `AsyncLocalStorage`.
- Le pilote Mongo (surveillance des commandes) et `JustWatchGraphqlCatalog.post` y ajoutent leurs durées.
- Une enveloppe `withTiming` (`src/app/api/withTiming.ts`) exécute un route handler dans ce contexte et ajoute l'en-tête.
- Le domaine et l'application ne changent pas.

**Tech Stack :** Next.js 15 App Router (runtime Node), TypeScript, pilote `mongodb` (`monitorCommands`), Vitest.

**Spec :** `docs/superpowers/specs/2026-10-18-performances-chargement-design.md` (section « Lot 1 »).

## Global Constraints

- Volume vers JustWatch inchangé : aucune requête nouvelle.
- Appels à JustWatch uniquement côté serveur.
- Domaine et application inchangés : la mesure vit dans `src/infrastructure/timing/` et `src/app/api/`.
- En-tête : `Server-Timing: mongo;dur=…, justwatch;dur=…, total;dur=…`, durées en millisecondes, une décimale.
- Routes mesurées dans ce lot : `GET /api/watchlist` et `GET /api/titles/[id]/availability`. `POST /api/watchlist/check` sera ajoutée au lot 2.
- Région : `vercel.json` contient `"regions": ["cdg1"]`. Cette modification est déjà présente, non commitée, dans la copie de travail.
- Tests Vitest écrits avant le code. Puis `npx vitest run`, `npx tsc --noEmit` (vérifier le code de sortie, sans pipe) et `npm run build`.
- Commits : Conventional Commits en français, détaillés, terminés par la ligne `Co-Authored-By` du modèle qui les écrit.
- Le dépôt GitHub est **public** : aucun secret dans les commits.
- Branche `perf/chargement`, PR vers `main`.

---

### Tâche 1 : module de mesure par requête

**Fichiers :**
- Créer : `src/infrastructure/timing/requestTiming.ts`
- Test : `src/infrastructure/timing/requestTiming.test.ts`

**Interfaces :**
- Produit :
  - `type TimingKey = "mongo" | "justwatch"` ;
  - `addTiming(key: TimingKey, ms: number): void` : sans effet hors d'un contexte de mesure ;
  - `measure<T>(key: TimingKey, fn: () => Promise<T>): Promise<T>` : chronomètre `fn`, y compris quand elle échoue ;
  - `runWithTiming<T>(fn: () => Promise<T>): Promise<{ result: T; timings: Record<TimingKey, number>; totalMs: number }>` ;
  - `serverTimingHeader(timings: Record<TimingKey, number>, totalMs: number): string`.

- [ ] **Étape 1 : écrire les tests**

```ts
import { describe, expect, it } from "vitest";
import { addTiming, measure, runWithTiming, serverTimingHeader } from "./requestTiming";

describe("requestTiming", () => {
  it("cumule les durées ajoutées pendant la requête", async () => {
    const { result, timings, totalMs } = await runWithTiming(async () => {
      addTiming("mongo", 2);
      addTiming("mongo", 3.5);
      addTiming("justwatch", 10);
      return "ok";
    });
    expect(result).toBe("ok");
    expect(timings).toEqual({ mongo: 5.5, justwatch: 10 });
    expect(totalMs).toBeGreaterThanOrEqual(0);
  });

  it("isole deux requêtes simultanées", async () => {
    const pause = () => new Promise((resolve) => setTimeout(resolve, 5));
    const [a, b] = await Promise.all([
      runWithTiming(async () => {
        addTiming("mongo", 1);
        await pause();
        addTiming("mongo", 1);
      }),
      runWithTiming(async () => {
        await pause();
        addTiming("mongo", 7);
      }),
    ]);
    expect(a.timings.mongo).toBe(2);
    expect(b.timings.mongo).toBe(7);
  });

  it("ne fait rien hors d'une requête mesurée", () => {
    expect(() => addTiming("mongo", 1)).not.toThrow();
  });

  it("measure chronomètre aussi une fonction qui échoue", async () => {
    const { timings } = await runWithTiming(async () => {
      await expect(
        measure("justwatch", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error("panne");
        }),
      ).rejects.toThrow("panne");
    });
    expect(timings.justwatch).toBeGreaterThan(0);
  });

  it("formate l'en-tête avec une décimale", () => {
    expect(serverTimingHeader({ mongo: 12.345, justwatch: 0 }, 250.06)).toBe(
      "mongo;dur=12.3, justwatch;dur=0.0, total;dur=250.1",
    );
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Commande : `npx vitest run src/infrastructure/timing`
Attendu : échec, « Cannot find module './requestTiming' ».

- [ ] **Étape 3 : écrire le module**

```ts
// Mesure du temps passé par requête (Mongo, JustWatch), pour l'en-tête Server-Timing.
// Le contexte suit la requête à travers les appels asynchrones (AsyncLocalStorage) ;
// hors d'une requête mesurée, les durées sont ignorées.

import { AsyncLocalStorage } from "node:async_hooks";

export type TimingKey = "mongo" | "justwatch";

const storage = new AsyncLocalStorage<Record<TimingKey, number>>();

export function addTiming(key: TimingKey, ms: number): void {
  const timings = storage.getStore();
  if (timings) timings[key] += ms;
}

export async function measure<T>(key: TimingKey, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    addTiming(key, performance.now() - start);
  }
}

export async function runWithTiming<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; timings: Record<TimingKey, number>; totalMs: number }> {
  const timings: Record<TimingKey, number> = { mongo: 0, justwatch: 0 };
  const start = performance.now();
  const result = await storage.run(timings, fn);
  return { result, timings, totalMs: performance.now() - start };
}

export function serverTimingHeader(timings: Record<TimingKey, number>, totalMs: number): string {
  return [
    `mongo;dur=${timings.mongo.toFixed(1)}`,
    `justwatch;dur=${timings.justwatch.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ].join(", ");
}
```

- [ ] **Étape 4 : vérifier la réussite**

Commande : `npx vitest run src/infrastructure/timing`
Attendu : 5 tests réussis.

- [ ] **Étape 5 : commit**

```bash
git add src/infrastructure/timing
git commit -F - <<'EOF'
feat: mesure du temps Mongo et JustWatch par requête

Module requestTiming : un AsyncLocalStorage cumule, pour chaque requête,
le temps passé dans Mongo et dans JustWatch, et formate l'en-tête
Server-Timing. Hors d'une requête mesurée, les durées sont ignorées.

Co-Authored-By: <modèle> <noreply@anthropic.com>
EOF
```

---

### Tâche 2 : brancher la mesure (Mongo, JustWatch, routes)

**Fichiers :**
- Modifier : `src/infrastructure/mongo/client.ts`
- Modifier : `src/infrastructure/justwatch/JustWatchGraphqlCatalog.ts` (méthode `post`, vers la ligne 217)
- Créer : `src/app/api/withTiming.ts`
- Test : `src/app/api/withTiming.test.ts`
- Modifier : `src/app/api/watchlist/route.ts` (seulement `GET`)
- Modifier : `src/app/api/titles/[id]/availability/route.ts`

**Interfaces :**
- Consomme (tâche 1) : `addTiming`, `measure`, `runWithTiming`, `serverTimingHeader`.
- Produit : `withTiming<A extends unknown[]>(handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response>`. Le lot 2 l'appliquera à `POST /api/watchlist/check`.

- [ ] **Étape 1 : écrire le test de `withTiming`**

```ts
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { addTiming } from "@/infrastructure/timing/requestTiming";
import { withTiming } from "./withTiming";

describe("withTiming", () => {
  it("ajoute l'en-tête Server-Timing à la réponse du handler", async () => {
    const handler = withTiming(async (id: string) => {
      addTiming("mongo", 4);
      return NextResponse.json({ id });
    });
    const response = await handler("tm1");
    expect(await response.json()).toEqual({ id: "tm1" });
    expect(response.headers.get("Server-Timing")).toMatch(/^mongo;dur=4\.0, justwatch;dur=0\.0, total;dur=\d+\.\d$/);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Commande : `npx vitest run src/app/api/withTiming.test.ts`
Attendu : échec, « Cannot find module './withTiming' ».

- [ ] **Étape 3 : écrire `withTiming`**

`src/app/api/withTiming.ts` :

```ts
import { runWithTiming, serverTimingHeader } from "@/infrastructure/timing/requestTiming";

// Exécute un route handler dans un contexte de mesure et ajoute l'en-tête Server-Timing
// (temps Mongo, JustWatch et total), visible dans l'onglet Réseau du navigateur.
export function withTiming<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    const { result, timings, totalMs } = await runWithTiming(() => handler(...args));
    result.headers.set("Server-Timing", serverTimingHeader(timings, totalMs));
    return result;
  };
}
```

- [ ] **Étape 4 : vérifier la réussite**

Commande : `npx vitest run src/app/api/withTiming.test.ts`
Attendu : 1 test réussi.

- [ ] **Étape 5 : mesurer Mongo dans `client.ts`**

Remplacer le contenu de `src/infrastructure/mongo/client.ts` par :

```ts
import { MongoClient, type Db } from "mongodb";
import { addTiming } from "../timing/requestTiming";

// Un seul client par instance de fonction, réutilisé entre les invocations
// (et entre les rechargements à chaud en développement).
const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

export function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant");
  globalForMongo.mongoClient ??= createClient(uri).connect();
  return globalForMongo.mongoClient.then((client) => client.db(process.env.MONGODB_DB ?? "geowatch"));
}

// Surveillance des commandes : leur durée alimente l'en-tête Server-Timing de la requête en cours.
function createClient(uri: string): MongoClient {
  const client = new MongoClient(uri, { monitorCommands: true });
  client.on("commandSucceeded", (event) => addTiming("mongo", event.duration));
  client.on("commandFailed", (event) => addTiming("mongo", event.duration));
  return client;
}
```

- [ ] **Étape 6 : mesurer JustWatch dans `post`**

Dans `JustWatchGraphqlCatalog.ts` :
- ajouter l'import `import { measure } from "../timing/requestTiming";` ;
- renommer la méthode privée actuelle `post<T>(body)` en `send<T>(body)`, sans changer son contenu ;
- ajouter juste au-dessus :

```ts
  // Chaque appel compte dans le temps « justwatch » de l'en-tête Server-Timing.
  private post<T>(body: object): Promise<T> {
    return measure("justwatch", () => this.send<T>(body));
  }
```

- [ ] **Étape 7 : envelopper les deux routes**

`src/app/api/watchlist/route.ts` : remplacer `export async function GET() { … }` par l'équivalent enveloppé, avec le même corps. Ajouter `import { withTiming } from "../withTiming";` et laisser `POST` inchangé.

```ts
export const GET = withTiming(async () => {
  try {
    return NextResponse.json({ items: await watchlistOverview.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
});
```

`src/app/api/titles/[id]/availability/route.ts` : faire de même. Ajouter `import { withTiming } from "../../../withTiming";`, puis :

```ts
export const GET = withTiming(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const search = request.nextUrl.searchParams;
    const countries = (search.get("countries") ?? "").split(",").filter(Boolean);
    const availabilities = await getTitleAvailability.execute((await params).id, countries, {
      refresh: search.get("refresh") === "1",
    });
    const entries = Object.values(availabilities);
    return NextResponse.json({
      offers: Object.fromEntries(entries.map((a) => [a.country, a.offers])),
      checkedAt: Object.fromEntries(entries.map((a) => [a.country, a.fetchedAt.toISOString()])),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
});
```

Mettre à jour le commentaire d'en-tête de chaque route avec une ligne : « Réponse avec l'en-tête Server-Timing (mongo, justwatch, total). »

- [ ] **Étape 8 : vérifications**

```
npx vitest run
npx tsc --noEmit
npm run build
```

Attendu :
- tous les tests passent ;
- `tsc` renvoie 0 ;
- le build réussit sans erreur « invalid GET export » et liste les deux routes en `ƒ`.

- [ ] **Étape 9 : commit**

```bash
git add src/infrastructure/mongo/client.ts src/infrastructure/justwatch/JustWatchGraphqlCatalog.ts src/app/api/withTiming.ts src/app/api/withTiming.test.ts src/app/api/watchlist/route.ts "src/app/api/titles/[id]/availability/route.ts"
git commit -F - <<'EOF'
feat: en-tête Server-Timing sur la liste et les disponibilités

Le client Mongo surveille ses commandes et ajoute leur durée au temps
« mongo » de la requête ; chaque appel GraphQL à JustWatch compte dans le
temps « justwatch ». withTiming enveloppe GET /api/watchlist et
GET /api/titles/[id]/availability et ajoute l'en-tête Server-Timing
(mongo, justwatch, total), lisible dans l'onglet Réseau du navigateur.

Co-Authored-By: <modèle> <noreply@anthropic.com>
EOF
```

---

### Tâche 3 : vérification locale, région, PR et mesures

Tâche du contrôleur, pas d'un sous-agent : elle pousse, ouvre la PR et a besoin de l'utilisateur.

**Fichiers :**
- Script hors du dépôt : `C:\Users\chris\AppData\Local\Temp\claude\f--Dev-GeoWatch\e6f1fdf7-d033-4fe3-8174-91442f1ea83a\scratchpad\timing.mjs`
- Commit : `vercel.json`

- [ ] **Étape 1 : script de bout en bout local**

Il suit le modèle de `scratchpad/import.mjs` : `next start -p 3132`, Mongo en mémoire, connexion avec `APP_PASSWORD: "motdepasse-test"`. Il vérifie :
- l'en-tête `Server-Timing` de `GET /api/watchlist` : `mongo` supérieur à 0 et `justwatch` à 0, sur une liste vide ;
- celui de `GET /api/titles/tm92641/availability?countries=FR,BE` deux fois de suite : au premier appel, `justwatch` supérieur à 0 ; au second, `justwatch;dur=0.0` grâce au cache du jour.

Deux requêtes JustWatch en tout. Lancer `npm run build`, puis `node …\timing.mjs`. Vérifier ensuite que le port 3132 est libéré (`netstat -ano | grep :3132`).

- [ ] **Étape 2 : pousser la mesure seule (région iad1)**

Pousser les commits des tâches 1 et 2 sans `vercel.json`, puis ouvrir la PR vers `main` (titre : « perf: mesure Server-Timing et région cdg1 »). La prévisualisation tourne encore en `iad1`.

L'utilisateur s'y connecte et relève `Server-Timing` dans l'onglet Réseau sur trois écrans :
- l'accueil (`/api/watchlist`) ;
- « Ma liste » ;
- un titre (`/api/titles/…/availability`, premier lot et suivants).

- [ ] **Étape 3 : commiter la région**

```bash
git add vercel.json
git commit -F - <<'EOF'
perf: fonctions Vercel en cdg1, à côté du cluster Atlas

Le cluster MongoDB Atlas est à Paris ; en iad1, chaque accès à Mongo
traversait l'Atlantique. La région cdg1 (Paris) les rapproche. JustWatch
reste appelé depuis le serveur uniquement.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push
```

L'utilisateur refait les mêmes relevés sur la nouvelle prévisualisation, qui tourne en `cdg1`. Il vérifie surtout que les pays s'affichent sur la page d'un titre : c'est la preuve que JustWatch accepte les appels depuis `cdg1`. S'il les bloque, retirer le commit de région (`git revert`) et ne fusionner que la mesure.

- [ ] **Étape 4 : compléter la PR**

- Ajouter au corps de la PR le tableau des relevés avant et après.
- Mettre à jour le `CLAUDE.md` local (ignoré par Git) : région `cdg1`, et la validation de JustWatch depuis `cdg1`, avec sa date.
