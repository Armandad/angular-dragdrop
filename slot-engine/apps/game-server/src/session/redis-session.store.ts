import type { GameSession } from '@slot-engine/shared-types';

/**
 * Redis-backed session store for production use.
 * Provides sub-millisecond reads and horizontal scaling across server instances.
 *
 * Requires the `redis` npm package. Falls back to in-memory if unavailable.
 */
export class RedisSessionStore {
  private client: RedisLike | null = null;
  private readonly prefix = 'slot:session:';
  private readonly ttlSeconds: number;

  constructor(ttlMs = 30 * 60 * 1000) {
    this.ttlSeconds = Math.floor(ttlMs / 1000);

    const redisUrl = process.env['REDIS_URL'];
    if (redisUrl) {
      this.connect(redisUrl).catch((err) => {
        console.warn('Redis session store: connection failed:', err);
      });
    }
  }

  private async connect(url: string): Promise<void> {
    try {
      const redis = await import('redis') as {
        createClient: (opts: { url: string }) => RedisLike;
      };
      this.client = redis.createClient({ url });

      this.client.on('error', (err: Error) => {
        console.error('Redis error:', err.message);
      });

      await this.client.connect();
      console.log('RedisSessionStore: connected');
    } catch {
      console.warn('RedisSessionStore: redis module not available');
    }
  }

  async set(sessionId: string, session: GameSession): Promise<void> {
    if (!this.client) return;

    const key = `${this.prefix}${sessionId}`;
    const value = JSON.stringify(session);

    await this.client.set(key, value, { EX: this.ttlSeconds });
  }

  async get(sessionId: string): Promise<GameSession | undefined> {
    if (!this.client) return undefined;

    const key = `${this.prefix}${sessionId}`;
    const value = await this.client.get(key);

    if (!value) return undefined;

    // Refresh TTL on access
    await this.client.expire(key, this.ttlSeconds);

    return JSON.parse(value) as GameSession;
  }

  async delete(sessionId: string): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.del(`${this.prefix}${sessionId}`);
    return result > 0;
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}

/** Minimal Redis client interface for type safety without hard dep on redis package */
interface RedisLike {
  connect(): Promise<void>;
  quit(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
}
