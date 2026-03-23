import { createServer } from 'node:http';
import { GameRouter } from './game/game.router.js';
import { SessionStore } from './session/session.store.js';
import { GameRegistry } from './game/game.registry.js';
import { AuditLogger } from './audit/audit.logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

async function bootstrap(): Promise<void> {
  const sessionStore = new SessionStore();
  const gameRegistry = new GameRegistry();
  const auditLogger = new AuditLogger();
  const router = new GameRouter(sessionStore, gameRegistry, auditLogger);

  // Load all game definitions
  await gameRegistry.loadGames();

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      await router.handle(req, res);
    } catch (err) {
      console.error('Unhandled error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(PORT, () => {
    console.log(`Slot Engine Game Server running on port ${PORT}`);
    console.log(`Loaded games: ${gameRegistry.getGameIds().join(', ')}`);
  });
}

bootstrap().catch(console.error);
