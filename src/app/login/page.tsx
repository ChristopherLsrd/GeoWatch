"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

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
    <main className="login">
      <div className="login-box">
        <div className="login-brand">
          <span className="login-mark" aria-hidden="true">
            <GlobeAltIcon />
          </span>
          <h1>GeoWatch</h1>
          <p>Où regarder, partout dans le monde.</p>
        </div>
        <form className="login-card" onSubmit={onSubmit}>
          <label className="login-label" htmlFor="password">
            Mot de passe
          </label>
          <div className={error ? "login-field invalid" : "login-field"}>
            <LockClosedIcon aria-hidden="true" />
            <input
              id="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "password-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-eye"
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? <EyeSlashIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
            </button>
          </div>
          {error && (
            <p id="password-error" role="alert" className="login-error">
              <ExclamationCircleIcon aria-hidden="true" />
              {error}
            </p>
          )}
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Connexion…" : "Se connecter"}
            {!pending && <ArrowRightIcon aria-hidden="true" />}
          </button>
        </form>
        <p className="login-foot">
          <ShieldCheckIcon aria-hidden="true" />
          Accès privé · session de 30 jours
        </p>
      </div>
    </main>
  );
}
