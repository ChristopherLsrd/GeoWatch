// Adaptateur TitlePathLookup : la requête urlV2 de JustWatch (celle de son site) donne le titre
// d'une page à partir de son chemin, quel que soit le pays. Validé depuis Vercel le 2026-10-24.

import type { TitlePathLookup } from "@/domain/ports/TitlePathLookup";
import { JustWatchClient } from "./JustWatchClient";

const URL_QUERY = `
query GetUrlTitle($fullPath: String!) {
  urlV2(fullPath: $fullPath) {
    node { id __typename }
  }
}`;

const TITLE_TYPES = new Set(["Movie", "Show"]);

export class JustWatchTitlePaths implements TitlePathLookup {
  private readonly client: JustWatchClient;

  constructor(fetchFn: typeof fetch = fetch) {
    this.client = new JustWatchClient(fetchFn);
  }

  async byPath(path: string): Promise<string | null> {
    // Un chemin inconnu donne une erreur GraphQL accompagnée de urlV2 nul : à traiter comme « introuvable ».
    const { data } = await this.client.postAllowingErrors<{ urlV2: { node: { id: string; __typename: string } | null } | null }>({
      operationName: "GetUrlTitle",
      variables: { fullPath: path },
      query: URL_QUERY,
    });
    const node = data?.urlV2?.node;
    return node && TITLE_TYPES.has(node.__typename) ? node.id : null;
  }
}
