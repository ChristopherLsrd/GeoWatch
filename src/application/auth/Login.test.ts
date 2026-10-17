import { describe, expect, it } from "vitest";
import { Login, type LoginAttempt, type LoginAttemptRepository } from "./Login";

class InMemoryLoginAttempts implements LoginAttemptRepository {
  readonly attempts = new Map<string, LoginAttempt>();
  async find(key: string) {
    return this.attempts.get(key) ?? null;
  }
  async save(attempt: LoginAttempt) {
    this.attempts.set(attempt.key, attempt);
  }
  async delete(key: string) {
    this.attempts.delete(key);
  }
}

const MINUTE = 60_000;

function setup() {
  const repository = new InMemoryLoginAttempts();
  let now = new Date("2026-10-17T10:00:00Z");
  const login = new Login(repository, (password) => password === "secret", () => now);
  const advance = (ms: number) => (now = new Date(now.getTime() + ms));
  return { repository, login, advance };
}

describe("Login", () => {
  it("accepte le bon mot de passe", async () => {
    const { login } = setup();
    expect(await login.execute("1.2.3.4", "secret")).toEqual({ ok: true });
  });

  it("refuse un mauvais mot de passe", async () => {
    const { login } = setup();
    expect(await login.execute("1.2.3.4", "faux")).toEqual({ ok: false, reason: "invalid" });
  });

  it("bloque après 5 échecs, même avec le bon mot de passe", async () => {
    const { login } = setup();
    for (let i = 0; i < 4; i++) await login.execute("1.2.3.4", "faux");
    expect(await login.execute("1.2.3.4", "faux")).toEqual({ ok: false, reason: "blocked", retryAfterSeconds: 900 });
    expect(await login.execute("1.2.3.4", "secret")).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("débloque après 15 minutes", async () => {
    const { login, advance } = setup();
    for (let i = 0; i < 5; i++) await login.execute("1.2.3.4", "faux");
    advance(15 * MINUTE);
    expect(await login.execute("1.2.3.4", "secret")).toEqual({ ok: true });
  });

  it("ne compte que les échecs de la fenêtre de 15 minutes", async () => {
    const { login, advance } = setup();
    for (let i = 0; i < 4; i++) await login.execute("1.2.3.4", "faux");
    advance(16 * MINUTE);
    expect(await login.execute("1.2.3.4", "faux")).toEqual({ ok: false, reason: "invalid" });
  });

  it("efface les échecs après une connexion réussie", async () => {
    const { login, repository } = setup();
    await login.execute("1.2.3.4", "faux");
    await login.execute("1.2.3.4", "secret");
    expect(repository.attempts.size).toBe(0);
  });

  it("compte les échecs séparément par IP", async () => {
    const { login } = setup();
    for (let i = 0; i < 5; i++) await login.execute("1.2.3.4", "faux");
    expect(await login.execute("5.6.7.8", "secret")).toEqual({ ok: true });
  });
});
