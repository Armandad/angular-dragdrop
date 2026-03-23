import type { IncomingMessage, ServerResponse } from 'node:http';
import { GameService } from './game.service.js';
import type { SessionStore } from '../session/session.store.js';
import type { GameRegistry } from './game.registry.js';
import type { AuditLogger } from '../audit/audit.logger.js';
import type {
  SpinRequest,
  GambleRequest,
  CollectRequest,
} from '@slot-engine/shared-types';

export class GameRouter {
  private gameService: GameService;

  constructor(
    sessionStore: SessionStore,
    gameRegistry: GameRegistry,
    auditLogger: AuditLogger,
  ) {
    this.gameService = new GameService(sessionStore, gameRegistry, auditLogger);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    // Health check
    if (method === 'GET' && path === '/health') {
      this.json(res, 200, { status: 'ok' });
      return;
    }

    // List available games
    if (method === 'GET' && path === '/api/games') {
      const games = this.gameService.listGames();
      this.json(res, 200, { games });
      return;
    }

    // Create session
    if (method === 'POST' && path === '/api/session') {
      const body = await this.readBody(req);
      const session = this.gameService.createSession(
        body.playerId,
        body.gameId,
        body.rtpProfile ?? 96,
        body.initialBalance ?? 10000,
      );
      this.json(res, 201, session);
      return;
    }

    // Spin
    if (method === 'POST' && path === '/api/spin') {
      const body = (await this.readBody(req)) as SpinRequest;
      const result = this.gameService.spin(body);
      this.json(res, 200, result);
      return;
    }

    // Gamble (double-up)
    if (method === 'POST' && path === '/api/gamble') {
      const body = (await this.readBody(req)) as GambleRequest;
      const result = this.gameService.gamble(body);
      this.json(res, 200, result);
      return;
    }

    // Collect
    if (method === 'POST' && path === '/api/collect') {
      const body = (await this.readBody(req)) as CollectRequest;
      const result = this.gameService.collect(body);
      this.json(res, 200, result);
      return;
    }

    // Get session state
    if (method === 'GET' && path.startsWith('/api/session/')) {
      const sessionId = path.split('/').pop()!;
      const session = this.gameService.getSession(sessionId);
      if (!session) {
        this.json(res, 404, { error: 'Session not found' });
        return;
      }
      this.json(res, 200, session);
      return;
    }

    // 404
    this.json(res, 404, { error: 'Not found' });
  }

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          resolve(body);
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}
