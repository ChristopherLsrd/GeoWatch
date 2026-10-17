// Connexion de l'utilisateur unique, avec limitation des échecs par IP.

export type LoginAttempt = {
  key: string;
  failures: number;
  windowStart: Date;
  blockedUntil: Date | null;
};

export interface LoginAttemptRepository {
  find(key: string): Promise<LoginAttempt | null>;
  save(attempt: LoginAttempt): Promise<void>;
  delete(key: string): Promise<void>;
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "blocked"; retryAfterSeconds: number };

export type LoginPolicy = { maxFailures: number; windowMs: number; blockMs: number };

const DEFAULT_POLICY: LoginPolicy = { maxFailures: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 };

export class Login {
  constructor(
    private readonly attempts: LoginAttemptRepository,
    private readonly checkPassword: (password: string) => boolean,
    private readonly clock: () => Date = () => new Date(),
    private readonly policy: LoginPolicy = DEFAULT_POLICY,
  ) {}

  async execute(ip: string, password: string): Promise<LoginResult> {
    const now = this.clock();
    const previous = await this.attempts.find(ip);

    if (previous?.blockedUntil && previous.blockedUntil > now) {
      return blocked(previous.blockedUntil, now);
    }

    if (this.checkPassword(password)) {
      if (previous) await this.attempts.delete(ip);
      return { ok: true };
    }

    const windowExpired =
      !previous || previous.blockedUntil !== null || now.getTime() - previous.windowStart.getTime() >= this.policy.windowMs;
    const attempt: LoginAttempt = windowExpired
      ? { key: ip, failures: 1, windowStart: now, blockedUntil: null }
      : { ...previous, failures: previous.failures + 1 };

    if (attempt.failures >= this.policy.maxFailures) {
      attempt.blockedUntil = new Date(now.getTime() + this.policy.blockMs);
      await this.attempts.save(attempt);
      return blocked(attempt.blockedUntil, now);
    }

    await this.attempts.save(attempt);
    return { ok: false, reason: "invalid" };
  }
}

function blocked(until: Date, now: Date): LoginResult {
  return { ok: false, reason: "blocked", retryAfterSeconds: Math.ceil((until.getTime() - now.getTime()) / 1000) };
}
