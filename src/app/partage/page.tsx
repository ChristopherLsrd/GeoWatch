// SONDE TEMPORAIRE (remplacée dans la PR de la fonctionnalité) : affiche ce qu'Android transmet
// quand on partage vers GeoWatch, et propose de lancer la sonde sur le lien reçu.

type Params = { title?: string | string[]; text?: string | string[]; url?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function Partage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const fields = { title: first(params.title), text: first(params.text), url: first(params.url) };
  const link = [fields.url, fields.text, fields.title].map((v) => v.match(/https?:\/\/\S+/)?.[0]).find(Boolean) ?? null;
  const justwatchPath = link && /justwatch\.com/.test(link) ? new URL(link).pathname : null;
  const probe = link
    ? `/api/sonde-partage?${new URLSearchParams({ lien: link, ...(justwatchPath ? { chemin: justwatchPath } : {}) })}`
    : "/api/sonde-partage";

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1>Partage reçu</h1>
      <dl>
        {Object.entries(fields).map(([name, value]) => (
          <div key={name} style={{ marginBottom: 12 }}>
            <dt><code>{name}</code></dt>
            <dd style={{ margin: 0, wordBreak: "break-all" }}>{value || <em>vide</em>}</dd>
          </div>
        ))}
      </dl>
      <p>Lien extrait : {link ? <code style={{ wordBreak: "break-all" }}>{link}</code> : <em>aucun</em>}</p>
      <p><a href={probe}>Lancer la sonde sur ce lien</a></p>
    </main>
  );
}
