// Cible du menu Partager d'Android (share_target du manifeste) : retrouve le titre partagé
// et ouvre sa fiche. Sans contenu, retour à l'accueil.

import { redirect } from "next/navigation";
import { ShareResolver } from "../components/ShareResolver";

type Params = { title?: string | string[]; text?: string | string[]; url?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function Partage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const fields = { title: first(params.title), text: first(params.text), url: first(params.url) };
  if (!fields.title.trim() && !fields.text.trim() && !fields.url.trim()) redirect("/");
  return <ShareResolver title={fields.title} text={fields.text} url={fields.url} />;
}
