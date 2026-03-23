import { createServer } from 'node:http';
import { GameRouter } from './game/game.router.js';
import { SessionStore } from './session/session.store.js';
import { GameRegistry } from './game/game.registry.js';
import { AuditLogger } from './audit/audit.logger.js';
import { AggregatorRouter } from './aggregator/aggregator.router.js';
import { MockAggregatorAdapter } from './aggregator/aggregator.adapter.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { RequestLogger } from './middleware/request-logger.js';
import { withErrorHandler } from './middleware/error-handler.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

async function bootstrap(): Promise<void> {
  const sessionStore = new SessionStore();
  const gameRegistry = new GameRegistry();
  const auditLogger = new AuditLogger();
  const router = new GameRouter(sessionStore, gameRegistry, auditLogger);

  // Aggregator setup
  const aggregatorRouter = new AggregatorRouter();
  aggregatorRouter.registerAdapter(new MockAggregatorAdapter(), true);

  // Middleware
  const rateLimiter = new RateLimiter(200, 60_000); // 200 req/min
  const requestLogger = new RequestLogger('info');

  // Load all game definitions
  await gameRegistry.loadGames();

  const handler = withErrorHandler(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limiting
    if (!rateLimiter.middleware(req, res)) return;

    // Request logging
    const log = requestLogger.startRequest(req);

    // Route: aggregator endpoints
    const url = req.url ?? '/';
    if (url.startsWith('/aggregator/')) {
      const handled = await aggregatorRouter.handle(req, res);
      if (handled) {
        log.end(res);
        return;
      }
    }

    // Route: audit stats
    if (req.method === 'GET' && url === '/api/audit/stats') {
      const stats = auditLogger.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      log.end(res);
      return;
    }

    // Route: game API
    await router.handle(req, res);
    log.end(res);
  });

  const server = createServer(handler);

  server.listen(PORT, () => {
    console.log(`Slot Engine Game Server running on port ${PORT}`);
    console.log(`Loaded games: ${gameRegistry.getGameIds().join(', ')}`);
    console.log(`Rate limit: 200 requests/minute`);
    console.log(`Aggregator: mock (development mode)`);
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('\nShutting down...');
    server.close(() => {
      sessionStore.destroy();
      rateLimiter.destroy();
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(console.error);
