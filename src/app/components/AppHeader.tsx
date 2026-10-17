"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

// En-tête commun, masqué sur la page de connexion.
export function AppHeader() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <header className="app-header">
      <Link href="/" className="brand">
        GeoWatch
      </Link>
      <LogoutButton />
    </header>
  );
}
