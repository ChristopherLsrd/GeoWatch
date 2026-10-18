import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { LetterboxdImport } from "../../components/LetterboxdImport";

export const metadata = { title: "Importer depuis Letterboxd · GeoWatch" };

export default function LetterboxdImportPage() {
  return (
    <main className="container page">
      <Link href="/liste" className="back-link">
        <ArrowLeftIcon aria-hidden="true" />
        Ma liste
      </Link>
      <h1>Importer depuis Letterboxd</h1>
      <LetterboxdImport />
    </main>
  );
}
