import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { playGamble } from './gamble.js';
import { SeededRNG } from '../rng/rng.js';
import type { GambleConfig } from '@slot-engine/shared-types';

const GAMBLE_CONFIG: GambleConfig = {
  maxAttempts: 5,
  multiplier: 2,
  maxWinMultiple: 5000,
};

describe('playGamble', () => {
  it('should double the win on correct guess', () => {
    // Run many times to get both outcomes
    let doubledCount = 0;
    let lostCount = 0;

    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const result = playGamble(100, 'red', GAMBLE_CONFIG, 1, 10, rng);

      if (result.won) {
        assert.equal(result.newWinAmount, 200);
        doubledCount++;
      } else {
        assert.equal(result.newWinAmount, 0);
        lostCount++;
      }
    }

    // Should have roughly 50/50 distribution
    assert.ok(doubledCount > 20, `Expected wins, got ${doubledCount}`);
    assert.ok(lostCount > 20, `Expected losses, got ${lostCount}`);
  });

  it('should produce valid card results', () => {
    const rng = new SeededRNG(42);
    const result = playGamble(100, 'red', GAMBLE_CONFIG, 1, 10, rng);

    assert.ok(['hearts', 'diamonds', 'clubs', 'spades'].includes(result.card.suit));
    assert.ok(result.card.value >= 2 && result.card.value <= 14);
    assert.ok(['red', 'black'].includes(result.card.color));

    // Color should match suit
    if (result.card.suit === 'hearts' || result.card.suit === 'diamonds') {
      assert.equal(result.card.color, 'red');
    } else {
      assert.equal(result.card.color, 'black');
    }
  });

  it('should cap win at maxWinMultiple', () => {
    const rng = new SeededRNG(42);
    // Huge current win that would exceed cap
    const result = playGamble(100000, 'red', GAMBLE_CONFIG, 1, 10, rng);

    if (result.won) {
      const maxWin = GAMBLE_CONFIG.maxWinMultiple * 1 * 10; // 50000
      assert.ok(result.newWinAmount <= maxWin, `Win ${result.newWinAmount} exceeds cap ${maxWin}`);
    }
  });

  it('should be deterministic with same seed', () => {
    const rng1 = new SeededRNG(99);
    const rng2 = new SeededRNG(99);

    const r1 = playGamble(100, 'black', GAMBLE_CONFIG, 1, 10, rng1);
    const r2 = playGamble(100, 'black', GAMBLE_CONFIG, 1, 10, rng2);

    assert.deepEqual(r1.card, r2.card);
    assert.equal(r1.won, r2.won);
    assert.equal(r1.newWinAmount, r2.newWinAmount);
  });
});
