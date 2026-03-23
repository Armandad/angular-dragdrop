import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { runSimulation } from './simulator.js';
import { SeededRNG } from '../rng/rng.js';
import type { SimulationConfig } from './simulator.js';
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
    retrigger: false,
    maxRetriggers: 0,
  },
  scatterPay: true,
};

const REELS: ReelStrip[] = [
  [2, 3, 4, 3, 2, 4, 3, 2, 4, 3, 1, 4, 0, 3, 4, 2, 3, 4, 2, 3],
  [3, 2, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 3, 0, 4, 3, 2, 4, 3, 2],
  [4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 0, 4, 3, 2, 4, 3],
  [2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4],
  [3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2],
];

const PAYLINES: PaylineDef[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
];

describe('runSimulation', () => {
  it('should complete the requested number of spins', () => {
    const rng = new SeededRNG(42);
    const config: SimulationConfig = {
      totalSpins: 1000,
      betPerLine: 1,
      activeLines: 3,
      reelStrips: REELS,
      rowCount: 3,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      features: FEATURES,
    };

    const result = runSimulation(config, rng);
    assert.equal(result.totalSpins, 1000);
    assert.equal(result.totalBet, 3000); // 1 * 3 * 1000
  });

  it('should return valid RTP between 0 and 2', () => {
    const rng = new SeededRNG(42);
    const config: SimulationConfig = {
      totalSpins: 10000,
      betPerLine: 1,
      activeLines: 3,
      reelStrips: REELS,
      rowCount: 3,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      features: FEATURES,
    };

    const result = runSimulation(config, rng);
    assert.ok(result.rtp >= 0, `RTP ${result.rtp} should be >= 0`);
    assert.ok(result.rtp < 2, `RTP ${result.rtp} should be < 2`);
  });

  it('should have valid hit rate between 0 and 1', () => {
    const rng = new SeededRNG(42);
    const config: SimulationConfig = {
      totalSpins: 1000,
      betPerLine: 1,
      activeLines: 3,
      reelStrips: REELS,
      rowCount: 3,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      features: FEATURES,
    };

    const result = runSimulation(config, rng);
    assert.ok(result.hitRate >= 0 && result.hitRate <= 1);
  });

  it('should produce deterministic results', () => {
    const config: SimulationConfig = {
      totalSpins: 1000,
      betPerLine: 1,
      activeLines: 3,
      reelStrips: REELS,
      rowCount: 3,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      features: FEATURES,
    };

    const r1 = runSimulation(config, new SeededRNG(42));
    const r2 = runSimulation(config, new SeededRNG(42));

    assert.equal(r1.rtp, r2.rtp);
    assert.equal(r1.totalWin, r2.totalWin);
    assert.equal(r1.maxWin, r2.maxWin);
  });

  it('should track win distribution', () => {
    const rng = new SeededRNG(42);
    const config: SimulationConfig = {
      totalSpins: 1000,
      betPerLine: 1,
      activeLines: 3,
      reelStrips: REELS,
      rowCount: 3,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      features: FEATURES,
    };

    const result = runSimulation(config, rng);

    // All buckets should sum to total spins
    let totalInBuckets = 0;
    for (const count of Object.values(result.winDistribution)) {
      totalInBuckets += count;
    }
    assert.equal(totalInBuckets, 1000);
  });

  it('should call progress callback', () => {
    const rng = new SeededRNG(42);
    let callCount = 0;

    const config: SimulationConfig = {
      totalSpins: 1000,
      betPerLine: 1,
      activeLines: 3,
      reelStrips: REELS,
      rowCount: 3,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      features: FEATURES,
    };

    runSimulation(config, rng, () => { callCount++; });
    assert.ok(callCount > 0, 'Progress callback should be called');
  });
});
