import { PreferencesView } from "../components/PreferencesView";

export const metadata = { title: "Préférences · GeoWatch" };

export default function PreferencesPage() {
  return (
    <main className="container">
      <h1>Préférences</h1>
      <PreferencesView />
    </main>
  );
}
