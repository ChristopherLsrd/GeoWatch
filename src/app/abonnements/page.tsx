import { SubscriptionsView } from "../components/SubscriptionsView";

export const metadata = { title: "Abonnements · GeoWatch" };

export default function SubscriptionsPage() {
  return (
    <main className="container page">
      <div>
        <h1>Abonnements</h1>
        <p className="page-intro">Vos plateformes, pays par pays. Elles allument le badge « Chez moi » sur les titres disponibles.</p>
      </div>
      <SubscriptionsView />
    </main>
  );
}
