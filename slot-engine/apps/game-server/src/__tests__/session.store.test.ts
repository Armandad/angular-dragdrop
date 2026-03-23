import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { SessionStore } from '../session/session.store.js';
import type { GameSession } from '@slot-engine/shared-types';

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    sessionId: 'test-session-1',
    playerId: 'player-1',
    gameId: 'shining-crown',
    state: 'IDLE',
    balance: 10000,
    betPerLine: 1,
    activeLines: 10,
    totalBet: 10,
    currentWin: 0,
    freeSpinsRemaining: 0,
    freeSpinsTotalWin: 0,
    gambleAttempts: 0,
    roundId: '',
    rtpProfile: 96,
    ...overrides,
  };
}

describe('SessionStore', () => {
  const stores: SessionStore[] = [];

  afterEach(() => {
    for (const store of stores) store.destroy();
    stores.length = 0;
  });

  function createStore(ttlMs?: number): SessionStore {
    const store = new SessionStore(ttlMs);
    stores.push(store);
    return store;
  }

  it('should store and retrieve a session', () => {
    const store = createStore();
    const session = makeSession();
    store.set('s1', session);

    const retrieved = store.get('s1');
    assert.ok(retrieved);
    assert.equal(retrieved.sessionId, 'test-session-1');
    assert.equal(retrieved.balance, 10000);
  });

  it('should return undefined for missing sessions', () => {
    const store = createStore();
    assert.equal(store.get('nonexistent'), undefined);
  });

  it('should return a copy (not reference)', () => {
    const store = createStore();
    const session = makeSession();
    store.set('s1', session);

    const retrieved = store.get('s1');
    assert.ok(retrieved);
    retrieved.balance = 0;

    // Original should be unchanged
    const original = store.get('s1');
    assert.equal(original?.balance, 10000);
  });

  it('should delete sessions', () => {
    const store = createStore();
    store.set('s1', makeSession());
    assert.ok(store.get('s1'));

    const deleted = store.delete('s1');
    assert.ok(deleted);
    assert.equal(store.get('s1'), undefined);
  });

  it('should expire sessions after TTL', async () => {
    const store = createStore(50); // 50ms TTL
    store.set('s1', makeSession());

    assert.ok(store.get('s1'));

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 100));

    assert.equal(store.get('s1'), undefined);
  });

  it('should refresh TTL on access', async () => {
    const store = createStore(100);
    store.set('s1', makeSession());

    // Access at 50ms (refreshes TTL)
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(store.get('s1'), 'Should still exist at 50ms');

    // Access at 100ms (refreshed, so should survive)
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(store.get('s1'), 'Should still exist after TTL refresh');
  });
});
