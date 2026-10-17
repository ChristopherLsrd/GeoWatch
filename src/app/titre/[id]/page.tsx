import { TitleView } from "../../components/TitleView";

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="container title-container">
      <TitleView id={id} />
    </main>
  );
}
