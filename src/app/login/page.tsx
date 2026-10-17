"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (response.status === 429) {
      setError(`Trop de tentatives. Réessayez dans ${Math.ceil((body.retryAfterSeconds ?? 900) / 60)} min.`);
    } else if (response.status === 401) {
      setError("Mot de passe incorrect.");
    } else {
      setError("Erreur du serveur, réessayez plus tard.");
    }
    setPassword("");
    setPending(false);
  }

  return (
    <main style={{ maxWidth: 320, margin: "15vh auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>GeoWatch</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", width: "100%", margin: "8px 0", padding: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={pending} style={{ padding: "8px 16px" }}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
        {error && (
          <p role="alert" style={{ color: "#b00020" }}>
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
