"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";

export function LogoutButton({ className = "" }: { className?: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <button type="button" className={`logout-btn ${className}`.trim()} onClick={logout}>
      <ArrowRightStartOnRectangleIcon className="nav-icon" aria-hidden="true" />
      Se déconnecter
    </button>
  );
}
