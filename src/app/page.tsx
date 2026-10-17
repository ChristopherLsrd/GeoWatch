import { AlertsPanel } from "./components/AlertsPanel";
import { SearchBox } from "./components/SearchBox";
import { WatchlistCards } from "./components/WatchlistCards";

export default function Home() {
  return (
    <main className="container">
      <SearchBox />
      <AlertsPanel />
      <WatchlistCards />
    </main>
  );
}
