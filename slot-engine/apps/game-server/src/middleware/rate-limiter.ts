import type { IncomingMessage, ServerResponse } from 'node:http';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter.
 * In production, use Redis-backed rate limiting for horizontal scaling.
 */
export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 60_000,
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
  }

  /**
   * Check if a request should be rate limited.
   * Returns true if the request is allowed.
   */
  check(req: IncomingMessage): boolean {
    const key = this.getKey(req);
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now >= entry.resetAt) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    entry.count++;
    return entry.count <= this.maxRequests;
  }

  /**
   * Middleware function to apply rate limiting.
   */
  middleware(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.check(req)) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(this.windowMs / 1000)),
      });
      res.end(JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }));
      return false;
    }
    return true;
  }

  private getKey(req: IncomingMessage): string {
    // Use X-Forwarded-For if behind a proxy, else remote address
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]!.trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) {
        this.entries.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }
}
