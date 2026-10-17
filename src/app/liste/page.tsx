import { WatchlistView } from "../components/WatchlistView";

export const metadata = { title: "Ma liste · GeoWatch" };

export default function WatchlistPage() {
  return (
    <main className="container">
      <h1>Ma liste</h1>
      <WatchlistView />
    </main>
  );
}
