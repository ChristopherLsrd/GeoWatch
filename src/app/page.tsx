import { LogoutButton } from "./components/LogoutButton";

export default function Home() {
  return (
    <main>
      <h1>GeoWatch</h1>
      <p>
        Test de faisabilité : <a href="/api/faisabilite?titre=Inception">/api/faisabilite?titre=Inception</a>
      </p>
      <LogoutButton />
    </main>
  );
}
