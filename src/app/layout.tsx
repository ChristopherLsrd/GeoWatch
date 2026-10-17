import "./globals.css";
import { AppHeader } from "./components/AppHeader";

export const metadata = { title: "GeoWatch" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
