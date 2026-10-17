import { SubscriptionsView } from "../components/SubscriptionsView";

export const metadata = { title: "Abonnements · GeoWatch" };

export default function SubscriptionsPage() {
  return (
    <main className="container">
      <h1>Abonnements</h1>
      <SubscriptionsView />
    </main>
  );
}
