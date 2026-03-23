import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  evaluateLine,
  evaluateScatters,
  evaluateSpin,
  applyExpandingWilds,
} from './evaluator.js';
import type {
  ReelWindow,
  PaytableConfig,
  PaylineDef,
  FeatureConfig,
} from '@slot-engine/shared-types';

// Test paytable
const PAYTABLE: PaytableConfig = {
  symbols: [
    { id: 0, name: 'Scatter', type: 'scatter' },
    { id: 1, name: 'Wild', type: 'wild' },
    { id: 2, name: 'Seven', type: 'regular' },
    { id: 3, name: 'Grape', type: 'regular' },
    { id: 4, name: 'Cherry', type: 'regular' },
    { id: 5, name: 'ExpandWild', type: 'wild', expanding: true },
  ],
  pays: {
    1: { 3: 10, 4: 50, 5: 200 },
    2: { 3: 50, 4: 200, 5: 1000 },
    3: { 3: 20, 4: 80, 5: 400 },
    4: { 2: 2, 3: 5, 4: 25, 5: 100 },
  },
  scatterPays: {
    0: { 3: 5, 4: 20, 5: 100 },
  },
};

const FEATURES: FeatureConfig = {
  freeSpins: {
    triggerSymbol: 0,
    triggerCount: 3,
    spinsAwarded: 10,
    multiplier: 2,
    retrigger: true,
    maxRetriggers: 3,
  },
  scatterPay: true,
  expandingWilds: false,
};

const LINE_CENTER: PaylineDef = [1, 1, 1, 1, 1];

describe('evaluateLine', () => {
  it('should detect a 3-of-a-kind win', () => {
    const window: ReelWindow = [
      [0, 2, 0],
      [0, 2, 0],
      [0, 2, 0],
      [0, 3, 0],
      [0, 4, 0],
    ];

    const result = evaluateLine(window, LINE_CENTER, 0, PAYTABLE, 10);
    assert.ok(result, 'Should have a win');
    assert.equal(result.symbolId, 2);
    assert.equal(result.count, 3);
    assert.equal(result.payout, 50 * 10); // 50 multiplier * 10 bet
  });

  it('should detect a 5-of-a-kind win', () => {
    const window: ReelWindow = [
      [0, 3, 0],
      [0, 3, 0],
      [0, 3, 0],
      [0, 3, 0],
      [0, 3, 0],
    ];

    const result = evaluateLine(window, LINE_CENTER, 0, PAYTABLE, 5);
    assert.ok(result);
    assert.equal(result.symbolId, 3);
    assert.equal(result.count, 5);
    assert.equal(result.payout, 400 * 5);
  });

  it('should substitute wild symbols', () => {
    // Wild, Grape, Grape, other, other -> 3x Grape with wild sub
    const window: ReelWindow = [
      [0, 1, 0], // Wild
      [0, 3, 0], // Grape
      [0, 3, 0], // Grape
      [0, 4, 0], // Cherry (breaks)
      [0, 2, 0],
    ];

    const result = evaluateLine(window, LINE_CENTER, 0, PAYTABLE, 10);
    assert.ok(result);
    assert.equal(result.symbolId, 3); // Pays as Grape
    assert.equal(result.count, 3);
  });

  it('should handle all-wild line', () => {
    const window: ReelWindow = [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ];

    const result = evaluateLine(window, LINE_CENTER, 0, PAYTABLE, 10);
    assert.ok(result);
    assert.equal(result.symbolId, 1); // Pays as wild itself
    assert.equal(result.count, 5);
  });

  it('should return null for no win', () => {
    const window: ReelWindow = [
      [0, 2, 0],
      [0, 3, 0],
      [0, 4, 0],
      [0, 2, 0],
      [0, 3, 0],
    ];

    const result = evaluateLine(window, LINE_CENTER, 0, PAYTABLE, 10);
    assert.equal(result, null);
  });

  it('should handle 2-of-a-kind cherry win', () => {
    const window: ReelWindow = [
      [0, 4, 0],
      [0, 4, 0],
      [0, 2, 0],
      [0, 3, 0],
      [0, 3, 0],
    ];

    const result = evaluateLine(window, LINE_CENTER, 0, PAYTABLE, 10);
    assert.ok(result);
    assert.equal(result.symbolId, 4);
    assert.equal(result.count, 2);
    assert.equal(result.payout, 2 * 10); // Cherry x2 = 2
  });
});

describe('evaluateScatters', () => {
  it('should detect 3 scatter symbols', () => {
    const window: ReelWindow = [
      [0, 2, 3],
      [3, 2, 3],
      [0, 3, 3],
      [3, 3, 3],
      [0, 3, 3],
    ];

    const result = evaluateScatters(window, PAYTABLE, 100, FEATURES);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.symbolId, 0);
    assert.equal(result[0]!.count, 3);
    assert.equal(result[0]!.triggeredFeature, 'freeSpins');
    assert.equal(result[0]!.payout, 5 * 100); // scatter x3 = 5, * totalBet
  });

  it('should not trigger with only 2 scatters', () => {
    const window: ReelWindow = [
      [0, 2, 3],
      [3, 2, 3],
      [0, 3, 3],
      [3, 3, 3],
      [3, 3, 3],
    ];

    const result = evaluateScatters(window, PAYTABLE, 100, FEATURES);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.count, 2);
    assert.equal(result[0]!.triggeredFeature, undefined);
  });
});

describe('applyExpandingWilds', () => {
  it('should expand wilds to fill entire reel', () => {
    const expandPaytable: PaytableConfig = {
      ...PAYTABLE,
      symbols: [
        ...PAYTABLE.symbols,
      ],
    };

    const window: ReelWindow = [
      [2, 3, 4],
      [3, 5, 2], // 5 = expanding wild
      [4, 2, 3],
      [2, 3, 4],
      [3, 4, 2],
    ];

    const result = applyExpandingWilds(window, expandPaytable);
    // Reel 1 should be all expanding wilds
    assert.deepEqual(result[1], [5, 5, 5]);
    // Other reels unchanged
    assert.deepEqual(result[0], [2, 3, 4]);
    assert.deepEqual(result[2], [4, 2, 3]);
  });
});

describe('evaluateSpin', () => {
  const paylines: PaylineDef[] = [
    [1, 1, 1, 1, 1], // center
    [0, 0, 0, 0, 0], // top
    [2, 2, 2, 2, 2], // bottom
  ];

  it('should evaluate multiple winning lines', () => {
    const window: ReelWindow = [
      [3, 2, 4],
      [3, 2, 4],
      [3, 2, 4],
      [4, 3, 2],
      [2, 4, 3],
    ];

    const result = evaluateSpin(window, paylines, PAYTABLE, 10, 3, FEATURES);

    // Line 0 (center): 2,2,2 -> 3x Seven = 50*10 = 500
    // Line 1 (top): 3,3,3 -> 3x Grape = 20*10 = 200
    // Line 2 (bottom): 4,4,4 -> 3x Cherry = 5*10 = 50
    assert.ok(result.winLines.length >= 2, `Expected wins, got ${result.winLines.length}`);
    assert.ok(result.totalWin > 0);
  });

  it('should report zero win for no matches', () => {
    const window: ReelWindow = [
      [2, 3, 4],
      [3, 4, 2],
      [4, 2, 3],
      [2, 3, 4],
      [3, 4, 2],
    ];

    const result = evaluateSpin(window, paylines, PAYTABLE, 10, 3, FEATURES);
    assert.equal(result.totalWin, 0);
    assert.equal(result.winLines.length, 0);
  });

  it('should only evaluate active lines', () => {
    const window: ReelWindow = [
      [3, 2, 4],
      [3, 2, 4],
      [3, 2, 4],
      [4, 3, 2],
      [2, 4, 3],
    ];

    // Only 1 active line (center)
    const result = evaluateSpin(window, paylines, PAYTABLE, 10, 1, FEATURES);

    // Should only evaluate the center line
    for (const win of result.winLines) {
      assert.equal(win.lineIndex, 0, 'Only line 0 should be evaluated');
    }
  });
});
