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
      <nav className="nav">
        <Link href="/" className="brand">
          GeoWatch
        </Link>
        <Link
          href="/liste"
          className={pathname === "/liste" ? "nav-link active" : "nav-link"}
          aria-current={pathname === "/liste" ? "page" : undefined}
        >
          Ma liste
        </Link>
        <Link
          href="/abonnements"
          className={pathname === "/abonnements" ? "nav-link active" : "nav-link"}
          aria-current={pathname === "/abonnements" ? "page" : undefined}
        >
          Abonnements
        </Link>
      </nav>
      <LogoutButton />
    </header>
  );
}
