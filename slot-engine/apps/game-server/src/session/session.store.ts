import type { GameSession } from '@slot-engine/shared-types';

/**
 * In-memory session store with TTL cleanup.
 * In production, replace with Redis for sub-ms reads and horizontal scaling.
 */
export class SessionStore {
  private sessions = new Map<string, { session: GameSession; expiresAt: number }>();
  private readonly ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlMs: number = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;
    // Periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  set(sessionId: string, session: GameSession): void {
    this.sessions.set(sessionId, {
      session: { ...session },
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(sessionId: string): GameSession | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(sessionId);
      return undefined;
    }

    // Refresh TTL on access
    entry.expiresAt = Date.now() + this.ttlMs;
    return { ...entry.session };
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now > entry.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}
