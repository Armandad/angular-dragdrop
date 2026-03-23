import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { GameService } from '../game/game.service.js';
import { SessionStore } from '../session/session.store.js';
import { GameRegistry } from '../game/game.registry.js';
import { AuditLogger } from '../audit/audit.logger.js';
import { loadGameDefinition } from '@slot-engine/math-engine';

// Minimal test game setup
function createTestGameRegistry(): GameRegistry {
  const registry = new GameRegistry('/nonexistent');
  // Manually inject a test game
  const config = {
    gameId: 'test-game',
    name: 'Test Game',
    reelCount: 5,
    rowCount: 3,
    paylineCount: 3,
    denominations: [1, 2, 5],
    defaultDenomination: 1,
    minBetLines: 1,
    maxBetLines: 3,
    features: {
      gamble: { maxAttempts: 5, multiplier: 2, maxWinMultiple: 5000 },
    },
    rtpTargets: [96],
  };

  const paytable = {
    symbols: [
      { id: 0, name: 'Scatter', type: 'scatter' },
      { id: 1, name: 'Wild', type: 'wild' },
      { id: 2, name: 'Seven', type: 'regular' },
      { id: 3, name: 'Grape', type: 'regular' },
      { id: 4, name: 'Cherry', type: 'regular' },
    ],
    pays: {
      1: { 3: 10, 4: 50, 5: 200 },
      2: { 3: 50, 4: 200, 5: 1000 },
      3: { 3: 20, 4: 80, 5: 400 },
      4: { 2: 2, 3: 5, 4: 25, 5: 100 },
    },
    scatterPays: { 0: { 3: 5 } },
  };

  const paylines = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
  ];

  const strips = Array.from({ length: 5 }, () =>
    [2, 3, 4, 3, 2, 4, 3, 2, 4, 3, 1, 4, 3, 2, 4, 3, 2, 4, 2, 3],
  );

  const def = loadGameDefinition(config, paytable, paylines, { 96: strips });
  // Inject directly into registry's private map
  (registry as unknown as { games: Map<string, unknown> }).games = new Map([
    ['test-game', def],
  ]);

  return registry;
}

describe('GameService', () => {
  let service: GameService;
  let sessionStore: SessionStore;

  beforeEach(() => {
    sessionStore = new SessionStore();
    const registry = createTestGameRegistry();
    const auditLogger = new AuditLogger();
    service = new GameService(sessionStore, registry, auditLogger);
  });

  it('should create a session', () => {
    const session = service.createSession('player1', 'test-game', 96, 10000);

    assert.equal(session.playerId, 'player1');
    assert.equal(session.gameId, 'test-game');
    assert.equal(session.state, 'IDLE');
    assert.equal(session.balance, 10000);
    assert.ok(session.sessionId.length > 0);
  });

  it('should throw for unknown game', () => {
    assert.throws(
      () => service.createSession('player1', 'nonexistent', 96, 10000),
      /not found/,
    );
  });

  it('should perform a spin and deduct balance', () => {
    const session = service.createSession('player1', 'test-game', 96, 10000);

    const result = service.spin({
      sessionId: session.sessionId,
      betPerLine: 1,
      activeLines: 3,
    });

    assert.ok(result.roundId.length > 0);
    assert.ok(result.result.window.length === 5);
    assert.equal(result.balance, 10000 - 3 + result.result.totalWin);
  });

  it('should reject spin with insufficient balance', () => {
    const session = service.createSession('player1', 'test-game', 96, 1);

    assert.throws(
      () => service.spin({
        sessionId: session.sessionId,
        betPerLine: 5,
        activeLines: 3,
      }),
      /Insufficient balance/,
    );
  });

  it('should allow collect after a winning spin', () => {
    const session = service.createSession('player1', 'test-game', 96, 100000);

    // Spin until we get a win
    let spinResult;
    for (let i = 0; i < 100; i++) {
      spinResult = service.spin({
        sessionId: session.sessionId,
        betPerLine: 1,
        activeLines: 3,
      });

      if (spinResult.state === 'AWAITING_COLLECT') break;
    }

    if (spinResult?.state === 'AWAITING_COLLECT') {
      const collectResult = service.collect({ sessionId: session.sessionId });
      assert.ok(collectResult.collected > 0);
      assert.equal(collectResult.state, 'IDLE');
    }
  });

  it('should reject spin in wrong state', () => {
    const session = service.createSession('player1', 'test-game', 96, 100000);

    // Spin until we get a win (AWAITING_COLLECT)
    let spinResult;
    for (let i = 0; i < 100; i++) {
      spinResult = service.spin({
        sessionId: session.sessionId,
        betPerLine: 1,
        activeLines: 3,
      });
      if (spinResult.state === 'AWAITING_COLLECT') break;
    }

    if (spinResult?.state === 'AWAITING_COLLECT') {
      assert.throws(
        () => service.spin({
          sessionId: session.sessionId,
          betPerLine: 1,
          activeLines: 3,
        }),
        /Cannot spin in state/,
      );
    }
  });

  it('should list games', () => {
    const games = service.listGames();
    assert.equal(games.length, 1);
    assert.equal(games[0]!.gameId, 'test-game');
  });
});
