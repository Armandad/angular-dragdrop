import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { playFreeSpins } from './free-spins.js';
import { SeededRNG } from '../rng/rng.js';
import type { PaytableConfig, FeatureConfig, PaylineDef, ReelStrip } from '@slot-engine/shared-types';

const PAYTABLE: PaytableConfig = {
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
  scatterPays: {
    0: { 3: 5 },
  },
};

const FEATURES: FeatureConfig = {
  freeSpins: {
    triggerSymbol: 0,
    triggerCount: 3,
    spinsAwarded: 5,
    multiplier: 2,
    retrigger: true,
    maxRetriggers: 2,
  },
  scatterPay: true,
};

const REELS: ReelStrip[] = [
  [2, 3, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 1, 3, 4, 2, 3, 4, 2, 3],
  [3, 2, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 3, 2, 4, 3, 2, 4, 3, 2],
  [4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3],
  [2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4],
  [3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2],
];

const PAYLINES: PaylineDef[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
];

describe('playFreeSpins', () => {
  it('should play the correct number of spins', () => {
    const rng = new SeededRNG(42);
    const result = playFreeSpins(REELS, 3, PAYLINES, PAYTABLE, 1, 3, FEATURES, rng);

    assert.ok(result.totalSpinsPlayed >= 5, 'Should play at least 5 spins');
  });

  it('should apply multiplier to wins', () => {
    const rng = new SeededRNG(42);
    const result = playFreeSpins(REELS, 3, PAYLINES, PAYTABLE, 1, 3, FEATURES, rng);

    // All wins should be even numbers if multiplier is 2
    for (const spin of result.spins) {
      if (spin.totalWin > 0) {
        assert.equal(
          spin.totalWin % 2, 0,
          `Win ${spin.totalWin} should be even (x2 multiplier)`,
        );
      }
    }
  });

  it('should return deterministic results with same seed', () => {
    const rng1 = new SeededRNG(77);
    const rng2 = new SeededRNG(77);

    const r1 = playFreeSpins(REELS, 3, PAYLINES, PAYTABLE, 1, 3, FEATURES, rng1);
    const r2 = playFreeSpins(REELS, 3, PAYLINES, PAYTABLE, 1, 3, FEATURES, rng2);

    assert.equal(r1.totalSpinsPlayed, r2.totalSpinsPlayed);
    assert.equal(r1.totalWin, r2.totalWin);
  });

  it('should handle missing free spins config gracefully', () => {
    const rng = new SeededRNG(42);
    const noFsFeatures: FeatureConfig = {};

    const result = playFreeSpins(REELS, 3, PAYLINES, PAYTABLE, 1, 3, noFsFeatures, rng);
    assert.equal(result.totalSpinsPlayed, 0);
    assert.equal(result.totalWin, 0);
  });
});
