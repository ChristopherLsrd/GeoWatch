import { JUSTWATCH_COUNTRIES } from "@/config/countries";
import { AlertsPanel } from "./components/AlertsPanel";
import { SearchBox } from "./components/SearchBox";
import { WatchlistCards } from "./components/WatchlistCards";

export default function Home() {
  return (
    <main className="container home">
      <div className="home-hero">
        <p className="eyebrow">Disponibilités · {JUSTWATCH_COUNTRIES.length} pays</p>
        <h1>Où regarder ce soir ?</h1>
        <SearchBox />
      </div>
      <AlertsPanel />
      <WatchlistCards />
    </main>
  );
}
