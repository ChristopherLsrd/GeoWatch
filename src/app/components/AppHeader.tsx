"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  Bars3Icon,
  BookmarkIcon,
  ChevronRightIcon,
  CreditCardIcon,
  GlobeAltIcon,
  HomeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { LogoutButton } from "./LogoutButton";

const LINKS = [
  { href: "/", label: "Accueil", Icon: HomeIcon },
  { href: "/liste", label: "Ma liste", Icon: BookmarkIcon },
  { href: "/abonnements", label: "Abonnements", Icon: CreditCardIcon },
  { href: "/preferences", label: "Préférences", Icon: AdjustmentsHorizontalIcon },
];

// En-tête commun, masqué sur la page de connexion. Menu burger sous 768 px.
export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Fermeture au changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Échap ferme le menu.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Après une fermeture, le focus revient au bouton burger.
  useEffect(() => {
    if (wasOpen.current && !open) burgerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (pathname === "/login") return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href);

  return (
    <header className="app-header">
      <Link href="/" className="brand" aria-label="GeoWatch, accueil">
        <span className="brand-mark">
          <GlobeAltIcon className="nav-icon" aria-hidden="true" />
        </span>
        <span>GeoWatch</span>
      </Link>
      <nav className="nav" aria-label="Navigation principale">
        {LINKS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? "nav-link active" : "nav-link"}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon className="nav-icon" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <LogoutButton className="header-logout" />
      <button
        ref={burgerRef}
        type="button"
        className="burger"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <XMarkIcon className="nav-icon" aria-hidden="true" />
        ) : (
          <Bars3Icon className="nav-icon" aria-hidden="true" />
        )}
      </button>
      {open && (
        <>
          <button type="button" className="mobile-scrim" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <nav id="mobile-menu" className="mobile-menu" aria-label="Navigation mobile">
            <div className="mobile-menu-head">Navigation</div>
            {LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={isActive(href) ? "mobile-link active" : "mobile-link"}
                aria-current={isActive(href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon className="nav-icon" aria-hidden="true" />
                {label}
                <ChevronRightIcon className="chev" aria-hidden="true" />
              </Link>
            ))}
            <LogoutButton className="mobile-logout" />
          </nav>
        </>
      )}
    </header>
  );
}
