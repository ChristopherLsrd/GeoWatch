import { RatingView } from "../../../components/RatingView";

export default async function RatingPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string; code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { country, code } = await params;
  const raw = await searchParams;
  const initial = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") initial.set(key, value);
  return (
    <main className="container title-container">
      <RatingView country={decodeURIComponent(country)} code={decodeURIComponent(code)} initialSearch={initial.toString()} />
    </main>
  );
}
