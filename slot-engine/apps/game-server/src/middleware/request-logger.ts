import type { IncomingMessage, ServerResponse } from 'node:http';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
}

/**
 * Request logging middleware.
 * Logs method, path, status, and duration for every request.
 */
export class RequestLogger {
  private minLevel: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.minLevel = level;
  }

  /**
   * Wraps a request handler with logging.
   * Call startRequest before handling, endRequest after.
   */
  startRequest(req: IncomingMessage): { end: (res: ServerResponse) => void } {
    const start = performance.now();

    return {
      end: (res: ServerResponse) => {
        const duration = performance.now() - start;
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          method: req.method ?? 'UNKNOWN',
          path: req.url ?? '/',
          statusCode: res.statusCode,
          durationMs: Math.round(duration * 100) / 100,
          ip: this.getIp(req),
        };

        this.log(entry);
      },
    };
  }

  private log(entry: LogEntry): void {
    const statusColor = entry.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const reset = '\x1b[0m';

    const line = `${entry.timestamp} ${entry.method.padEnd(6)} ${entry.path.padEnd(30)} ${statusColor}${entry.statusCode}${reset} ${entry.durationMs}ms [${entry.ip}]`;

    if (entry.statusCode >= 500) {
      console.error(line);
    } else if (entry.statusCode >= 400) {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private getIp(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]!.trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }
}
