import { PersonView } from "../../components/PersonView";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const { id } = await params;
  const { role: rawRole } = await searchParams;
  const role = typeof rawRole === "string" ? rawRole : undefined;
  return (
    <main className="container title-container">
      <PersonView id={id} initialRole={role} />
    </main>
  );
}
