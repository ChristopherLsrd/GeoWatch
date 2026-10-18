import { JUSTWATCH_COUNTRIES } from "@/config/countries";
import { AlertsPanel } from "./components/AlertsPanel";
import { SearchBox } from "./components/SearchBox";
import { WatchlistCards } from "./components/WatchlistCards";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  // Recherche préremplie par ?q= (lien « Chercher dans GeoWatch » de l'import Letterboxd).
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q) ?? "";
  return (
    <main className="container home">
      <div className="home-hero">
        <p className="eyebrow">Disponibilités · {JUSTWATCH_COUNTRIES.length} pays</p>
        <h1>Où regarder ce soir ?</h1>
        <SearchBox initialQuery={initialQuery} />
      </div>
      <AlertsPanel />
      <WatchlistCards />
    </main>
  );
}
