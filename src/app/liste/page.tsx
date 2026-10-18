import Link from "next/link";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { WatchlistView } from "../components/WatchlistView";

export const metadata = { title: "Ma liste · GeoWatch" };

export default function WatchlistPage() {
  return (
    <main className="container page">
      <div className="page-head">
        <h1>Ma liste</h1>
        <Link href="/liste/import" className="button-link">
          <ArrowUpTrayIcon aria-hidden="true" />
          Importer depuis Letterboxd
        </Link>
      </div>
      <WatchlistView />
    </main>
  );
}
