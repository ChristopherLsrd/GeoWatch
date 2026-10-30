import { PreferencesView } from "../components/PreferencesView";
import { NotificationsSettings } from "../components/NotificationsSettings";

export const metadata = { title: "Préférences · GeoWatch" };

export default function PreferencesPage() {
  return (
    <main className="container page">
      <div>
        <h1>Préférences</h1>
        <p className="page-intro">Ces langues pré-remplissent les filtres sur la page d&apos;un titre. Vous pouvez toujours les changer.</p>
      </div>
      <PreferencesView />
      <h2 className="section-title">Notifications</h2>
      <NotificationsSettings />
    </main>
  );
}
